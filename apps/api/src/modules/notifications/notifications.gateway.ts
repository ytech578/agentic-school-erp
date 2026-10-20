import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

function isAllowedOrigin(origin?: string): boolean {
  // Native/mobile and internal server connections may not send Origin.
  if (!origin) return true;
  const configured = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured.includes(origin)) return true;
  return (
    process.env.NODE_ENV !== 'production' &&
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  );
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    credentials: true,
  },
  allowRequest: (request, callback) =>
    callback(null, isAllowedOrigin(request.headers.origin)),
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  // Mapping userId to socket ID
  private userSockets: Map<string, string[]> = new Map();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Expect token in handshake auth or headers
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        client.disconnect();
        return;
      }

      const secret =
        this.configService.get<string>('jwt.accessSecret') ||
        process.env.JWT_ACCESS_SECRET;
      if (!secret) throw new Error('JWT Access Secret is not configured');
      const decoded = this.jwtService.verify(token, { secret });

      const userId = decoded.sub;
      client.data.userId = userId;

      const sockets = this.userSockets.get(userId) || [];
      sockets.push(client.id);
      this.userSockets.set(userId, sockets);

      this.logger.debug(`Client connected: ${client.id} (User: ${userId})`);
    } catch (e) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      const sockets = this.userSockets.get(userId) || [];
      const updatedSockets = sockets.filter((id) => id !== client.id);
      if (updatedSockets.length === 0) {
        this.userSockets.delete(userId);
      } else {
        this.userSockets.set(userId, updatedSockets);
      }
    }
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  // Called from NotificationsService to push an event to a user
  sendToUser(userId: string, payload: any) {
    const sockets = this.userSockets.get(userId);
    if (sockets && sockets.length > 0) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit('notification', payload);
      });
    }
  }
}
