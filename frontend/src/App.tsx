import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppToaster from "./components/AppToaster";
import PageLoader from "./components/PageLoader";
import RequireAuth from "./components/RequireAuth";

const Home = lazy(() => import("./page/Home"));
const LandingPage = lazy(() => import("./page/LandingPage"));
const Login = lazy(() => import("./page/Login"));

const App = () => {
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/home" element={<Home />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <AppToaster />
    </>
  );
};

export default App;
