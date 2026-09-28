import React from "react";
import { Route, Routes } from "react-router-dom";
const Home = React.lazy(() => import("./page/Home"));
const LandingPage = React.lazy(() => import("./page/LandingPage"));

const App = () => {
  return (
    <Routes>
      <Route path="" element={<LandingPage />} />
      <Route path="home" element={<Home />} />
    </Routes>
  );
};

export default App;
