import React from "react";
import { Route, Routes } from "react-router-dom";
const Home = React.lazy(() => import("./page/Home"));

const App = () => {
  return (
    <Routes>
      <Route path="" element={<Home />} />
    </Routes>
  );
};

export default App;
