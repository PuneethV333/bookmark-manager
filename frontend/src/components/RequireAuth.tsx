import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useFirebaseUid } from "../hooks/useAuth";
import PageLoader from "./PageLoader";

/** Layout route: renders the child page only for a signed-in Firebase user. */
const RequireAuth = () => {
  const { uid, loading } = useFirebaseUid();
  const location = useLocation();

  if (loading) return <PageLoader />;

  if (!uid) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

export default RequireAuth;
