import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const INDIAN_TEACHER_NAMES = [
  { first: 'Aarav', last: 'Patel' },
  { first: 'Diya', last: 'Reddy' },
  { first: 'Karan', last: 'Singhania' },
  { first: 'Neha', last: 'Verma' },
  { first: 'Rohan', last: 'Kapoor' },
  { first: 'Ananya', last: 'Iyer' },
  { first: 'Aditya', last: 'Nair' },
  { first: 'Riya', last: 'Desai' },
  { first: 'Siddharth', last: 'Jain' },
  { first: 'Pooja', last: 'Chauhan' },
  { first: 'Varun', last: 'Malhotra' },
  { first: 'Kavya', last: 'Rao' },
  { first: 'Amit', last: 'Bansal' },
  { first: 'Swati', last: 'Agarwal' },
  { first: 'Manoj', last: 'Tiwari' },
  { first: 'Kriti', last: 'Menon' },
  { first: 'Nitin', last: 'Sinha' },
  { first: 'Shruti', last: 'Hasan' },
  { first: 'Vivek', last: 'Das' },
  { first: 'Meera', last: 'Rajput' },
  { first: 'Gaurav', last: 'Sethi' },
  { first: 'Shreya', last: 'Ghoshal' },
  { first: 'Anil', last: 'Mishra' },
  { first: 'Deepa', last: 'Kumar' },
  { first: 'Suresh', last: 'Pandey' },
  { first: 'Anita', last: 'Bose' },
  { first: 'Rakesh', last: 'Rosh' },
  { first: 'Jyoti', last: 'Rathore' },
  { first: 'Dinesh', last: 'Bhatt' },
  { first: 'Preeti', last: 'Zinta' },
  { first: 'Alok', last: 'Nath' },
  { first: 'Richa', last: 'Chadda' },
  { first: 'Sanjay', last: 'Dutt' },
  { first: 'Bhumika', last: 'Chawla' },
  { first: 'Mahesh', last: 'Babu' },
  { first: 'Kajal', last: 'Aggarwal' },
  { first: 'Tarun', last: 'Tahiliani' },
  { first: 'Simran', last: 'Kaur' },
  { first: 'Gopal', last: 'Krishnan' },
  { first: 'Radhika', last: 'Apte' },
  { first: 'Ashok', last: 'Kumar' },
  { first: 'Divya', last: 'Bharti' },
  { first: 'Prakash', last: 'Raj' },
  { first: 'Nidhi', last: 'Agarwal' },
  { first: 'Subhash', last: 'Ghai' },
  { first: 'Aarti', last: 'Chabria' },
  { first: 'Kamal', last: 'Hassan' },
  { first: 'Rekha', last: 'Ganesan' },
  { first: 'Pradeep', last: 'Sarkar' },
  { first: 'Sunita', last: 'Williams' },
  { first: 'Ramesh', last: 'Sippy' },
  { first: 'Smriti', last: 'Irani' },
];

async function main() {
  console.log('Fetching teachers...');
  
  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER', firstName: { startsWith: 'Teacher' } }
  });

  console.log(`Found ${teachers.length} teachers to update.`);

  for (let i = 0; i < teachers.length; i++) {
    const name = INDIAN_TEACHER_NAMES[i % INDIAN_TEACHER_NAMES.length];
    
    await prisma.user.update({
      where: { id: teachers[i].id },
      data: {
        firstName: name.first,
        lastName: name.last
      }
    });
    console.log(`Updated ${teachers[i].email} -> ${name.first} ${name.last}`);
  }

  console.log('Done updating teachers.');
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
