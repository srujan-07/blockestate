import React, { useState } from "react";
import axios from "axios";

function App() {
  const [name, setName] = useState("");
  const [user, setUser] = useState("citizen1");
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  const registerPerson = async () => {
    try {
      const res = await axios.post(
        "http://localhost:4000/register",
        { name },
        {
          headers: {
            "Content-Type": "application/json",
            "x-user": user, // 🔑 Fabric identity
          },
        }
      );
      setResponse(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data || err.message);
      setResponse(null);
    }
  };

  return (
    <div style={{ padding: "40px", fontFamily: "Arial" }}>
      <h2>Blockchain Land Registry – Test UI</h2>

      <label>User (Fabric Identity):</label>
      <select value={user} onChange={(e) => setUser(e.target.value)}>
        <option value="citizen1">Citizen</option>
        <option value="tahsildar1">Tahsildar</option>
        <option value="registrar1">Registrar</option>
        <option value="bank1">Bank</option>
      </select>

      <br /><br />

      <label>Name:</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <br /><br />

      <button onClick={registerPerson}>Register Person</button>

      <br /><br />

      {response && (
        <pre style={{ color: "green" }}>
          {JSON.stringify(response, null, 2)}
        </pre>
      )}

      {error && (
        <pre style={{ color: "red" }}>
          {JSON.stringify(error, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default App;

