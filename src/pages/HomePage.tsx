import { useEffect, useState } from "react";
import { Link } from "react-router";
import { BrandLockup, Button } from "@pufferblow/spines";
import { getAuthToken } from "../services/auth";

export function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(!!getAuthToken());
  }, []);

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col items-center justify-center bg-background px-6 text-center">
      <BrandLockup size={72} className="mb-2 flex-col text-center" />
      <p className="mt-2 max-w-md text-text-secondary">
        Self-hosted, open-source community platform. Encrypted, federated, and fully under your control.
      </p>

      <div className="mt-8 flex gap-3">
        {isAuthenticated ? (
          <Link to="/dashboard">
            <Button size="lg">Open Dashboard</Button>
          </Link>
        ) : (
          <>
            <Link to="/login">
              <Button size="lg">Sign in</Button>
            </Link>
            <Link to="/signup">
              <Button size="lg" variant="secondary">
                Create account
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
