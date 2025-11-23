import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Perf } from "r3f-perf";
import { World } from "./components/World";
import "./App.css";

function App() {
  const [loading, setLoading] = useState(true);

  return (
    <>
      <Canvas
        camera={{ position: [0, 50, 0], fov: 50, near: 0.1, far: 1200 }}
        style={{ width: "100vw", height: "100vh", display: "block" }}
      >
        <World onLoadingChange={setLoading} />
      </Canvas>
      {loading && (
        <div
          style={{
            position: "fixed",
            top: "50px",
            left: "5px",
            color: "black",
            zIndex: 1000,
            fontFamily: "monospace",
            fontSize: "0.9rem",
            pointerEvents: "none",
          }}
        >
          Loading...
        </div>
      )}
      <div
        id="info"
        style={{
          position: "fixed",
          top: "50px",
          left: "5px",
          color: "white",
          zIndex: 1000,
          fontFamily: "monospace",
          fontSize: "0.9rem",
          display: loading ? "none" : "block",
          pointerEvents: "none",
        }}
      >
        Trees are rendered as octahedral impostors when far away. <br />⭐ If
        you like this example please leave a star on the{" "}
        <a
          href="https://github.com/agargaro/octahedral-impostor"
          style={{ color: "white", pointerEvents: "auto" }}
        >
          github repository
        </a>
        .
      </div>
    </>
  );
}

export default App;
