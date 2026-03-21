import type { AuthUser } from "@/core/types";

interface UserPanelProps {
  user: AuthUser;
  displayAlias: string;
  onLogout: () => void;
}

export function UserPanel({ user, displayAlias, onLogout }: UserPanelProps) {
  return (
    <section className="panel panel-split">
      <div>
        <h2 className="welcome-title">Welcome {displayAlias}!</h2>
        <p className="identity-line">
          <span className="identity-label">User ID:</span>{" "}
          <span className="identity-value">{user.id || "n/a"}</span>
        </p>
        <p className="identity-line">
          <span className="identity-label">Email:</span>{" "}
          <span className="identity-value">{user.email || "n/a"}</span>
        </p>
      </div>
      <button className="btn-danger" onClick={onLogout}>
        Logout
      </button>
    </section>
  );
}
