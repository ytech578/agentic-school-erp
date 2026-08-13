const axios = require('axios');

async function test() {
  try {
    // 1. Login
    const loginRes = await axios.post('http://localhost:4000/api/auth/login', {
      email: 'admin@sunriseschool.edu.in',
      password: 'Admin@1234'
    });
    const token = loginRes.data.data.accessToken;
    console.log("Logged in successfully");

    // 2. Fetch students
    const studentsRes = await axios.get('http://localhost:4000/api/students', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Students API Response:", JSON.stringify(studentsRes.data, null, 2));

  } catch (err) {
    console.error("Error:", err.response ? err.response.data : err.message);
  }
}

test();
