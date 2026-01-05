import { useState, useEffect } from "react";
import api from "@/lib/api";

const App = () => {
  const [greet, setGreet] = useState("Hey from web!");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/hello");
        setGreet(data.message);
      } catch (error) {
        console.log("Error:", error);
      }
    })();
  }, []);

  return (
    <div className="flex flex-col space-y-4">
      <h1 className="text-xl font-semibold">{greet}</h1>
    </div>
  );
};

export default App;
