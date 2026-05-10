// src/components/Sidebar.jsx — Week 7
// Updated recruiter nav: "Manage Jobs" replaces "Post a Job"

import { NavLink, Link, useNavigate } from "react-router-dom";
import {
  FiUser,
  FiBriefcase,
  FiFileText,
  FiSettings,
  FiLogOut,
  FiGrid,
  FiUsers,
  FiMessageSquare,
  FiEdit,
} from "react-icons/fi";

export default function Sidebar({ role, userData, unreadFeedbackCount = 0 }) {
  const navigate = useNavigate();

  const candidateNavItems = [
    { icon: FiUser,          label: "Profile",          path: "/candidate/profile" },
    { icon: FiMessageSquare, label: "Feedback",         path: "/candidate/feedback" },
    { icon: FiBriefcase,     label: "Job Board",        path: "/candidate/job-board" },
    { icon: FiFileText,      label: "My Applications",  path: "/candidate/applications" },
    { icon: FiSettings,      label: "Settings",         path: "/candidate/settings" },
  ];

  const recruiterNavItems = [
    { icon: FiGrid,          label: "Dashboard",        path: "/recruiter/dashboard" },
    { icon: FiUsers,         label: "Applicants",       path: "/recruiter/applicants" },
    // WEEK 7: Manage Jobs replaces "Post a Job"
    { icon: FiEdit,          label: "Manage Jobs",      path: "/recruiter/manage-jobs" },
    { icon: FiMessageSquare, label: "Feedback",         path: "/recruiter/feedback" },
    { icon: FiSettings,      label: "Settings",         path: "/recruiter/settings" },
  ];

  const navItems = role === "recruiter" ? recruiterNavItems : candidateNavItems;

  const userDisplay = {
    name:    `${userData.firstname} ${userData.lastname}`.trim(),
    email:   userData.email || "",
    initial: `${(userData.firstname || "").charAt(0)}${(userData.lastname || "").charAt(0)}`.toUpperCase() || "?",
  };

  const handleLogout = () => {
    if (role === "candidate") {
      localStorage.removeItem("token");
      navigate("/");
    } else if (role === "recruiter") {
      localStorage.removeItem("hr_token");
      navigate("/recruiter/login");
    } else {
      localStorage.clear();
      navigate("/");
    }
  };

  return (
    <aside className="w-64 flex-shrink-0 bg-white shadow-lg flex flex-col p-4 rounded-r-2xl">
      <div className="p-4 mb-4">
        <Link to="/" className="font-bold text-2xl text-dark">XCALIBR</Link>
      </div>

      <nav className="flex-grow">
        <ul>
          {navItems.map(item => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 my-1 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary text-white shadow-md"
                      : "text-slate-500 hover:bg-slate-100"
                  }`
                }
              >
                <item.icon size={20} />
                <span className="font-medium flex-1">{item.label}</span>
                {item.path === "/candidate/feedback" && unreadFeedbackCount > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                    {unreadFeedbackCount > 99 ? "99+" : unreadFeedbackCount}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto">
        <div className="flex items-center gap-3 p-2 border-t border-slate-200 pt-4">
          <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold flex-shrink-0">
            {userDisplay.initial}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-dark truncate">{userDisplay.name}</p>
            <p className="text-xs text-slate-500 truncate">{userDisplay.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-3 w-full mt-4 text-red-500 bg-red-50 hover:bg-red-100 p-3 rounded-lg font-semibold transition"
        >
          <FiLogOut />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
