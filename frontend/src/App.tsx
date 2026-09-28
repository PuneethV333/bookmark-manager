import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppToaster from "./components/AppToaster";
import PageLoader from "./components/PageLoader";

const Home = lazy(() => import("./page/Home"));
const LandingPage = lazy(() => import("./page/LandingPage"));

const App = () => {
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/home" element={<Home />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <AppToaster />
    </>
  );
};

export default App;
