import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Banknote,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Plus,
  Stethoscope,
} from "lucide-react";

import {
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "@/context/AuthContext";

import MonthNavigator from "@/components/MonthNavigator";
import AppToast from "@/components/AppToast";

import "@/styles/dashboard.css";


type Props = {
  children:React.ReactNode;
};


type FormDirtyEventDetail = {
  key:string;
  dirty:boolean;
};


type NavigationItem = {
  to:string;
  label:string;
  icon:React.ReactNode;
};


const navigationItems:NavigationItem[] = [
  {
    to:"/dashboard",
    label:"Dashboard",
    icon:<LayoutDashboard size={18} />,
  },
  {
    to:"/doctors",
    label:"Mjekët",
    icon:<Stethoscope size={18} />,
  },
  {
    to:"/works",
    label:"Punët",
    icon:<ClipboardList size={18} />,
  },
  {
    to:"/payments",
    label:"Pagesat",
    icon:<Banknote size={18} />,
  },
];


export default function Layout({
  children,
}:Props) {

  const {
    logout,
    user,
  } =
    useAuth();

  const navigate =
    useNavigate();

  const location =
    useLocation();

  const dirtyFormsRef =
    useRef<Set<string>>(
      new Set(),
    );

  const logoutRunningRef =
    useRef(false);

  const [
    escapeMessage,
    setEscapeMessage,
  ] =
    useState("");


  const showMonthNavigator =
    location.pathname === "/dashboard" ||
    location.pathname === "/works" ||
    location.pathname === "/payments" ||
    /^\/doctors\/[^/]+$/.test(
      location.pathname,
    );


  const pageTitle =
    useMemo(
      ()=>{

        if(location.pathname === "/dashboard") {
          return "Dashboard";
        }

        if(location.pathname === "/doctors") {
          return "Mjekët";
        }

        if(
          /^\/doctors\/[^/]+$/.test(
            location.pathname,
          )
        ) {
          return "Fleta e mjekut";
        }

        if(location.pathname === "/works") {
          return "Punët";
        }

        if(location.pathname === "/payments") {
          return "Pagesat";
        }

        return "DentalTrack";

      },
      [
        location.pathname,
      ],
    );


  const userInitials =
    useMemo(
      ()=>{

        const raw =
          String(
            user?.userId ?? "DT",
          )
            .trim()
            .replace(
              /[^a-zA-Z0-9]+/g,
              " ",
            );

        const parts =
          raw
            .split(/\s+/)
            .filter(Boolean);

        if(parts.length === 0) {
          return "DT";
        }

        if(parts.length === 1) {
          return parts[0]
            .slice(0,2)
            .toUpperCase();
        }

        return (
          parts[0][0] +
          parts[parts.length - 1][0]
        ).toUpperCase();

      },
      [
        user?.userId,
      ],
    );


  async function handleLogout() {

    if(logoutRunningRef.current) {
      return;
    }


    logoutRunningRef.current =
      true;


    try {

      await logout();

      navigate(
        "/login",
        {
          replace:true,
        },
      );


    } finally {

      logoutRunningRef.current =
        false;

    }

  }


  function showEscapeBlockedMessage() {

    setEscapeMessage(
      "Dalja me Esc u bllokua sepse formulari përmban ndryshime të paruajtura. Ruajini ose anuloni ndryshimet fillimisht.",
    );

  }


  useEffect(
    ()=>{

      function handleFormDirty(
        event:Event,
      ) {

        const detail =
          (
            event as CustomEvent<FormDirtyEventDetail>
          ).detail;


        if(
          !detail ||
          typeof detail.key !== "string"
        ) {
          return;
        }


        if(detail.dirty) {

          dirtyFormsRef.current.add(
            detail.key,
          );

        } else {

          dirtyFormsRef.current.delete(
            detail.key,
          );

        }

      }


      window.addEventListener(
        "dentaltrack:form-dirty",
        handleFormDirty,
      );


      return ()=>{

        window.removeEventListener(
          "dentaltrack:form-dirty",
          handleFormDirty,
        );

      };

    },
    [],
  );


  useEffect(
    ()=>{

      function handleEscape(
        event:KeyboardEvent,
      ) {

        const isEscape =
          event.key === "Escape" ||
          event.key === "Esc" ||
          event.code === "Escape" ||
          event.keyCode === 27;


        if(
          !isEscape ||
          event.repeat
        ) {
          return;
        }


        const modalSelectors = [
          ".works-modal-backdrop",
          ".doctor-work-drawer-backdrop",
          ".session-warning-backdrop",
          '[role="dialog"][aria-modal="true"]',
          '[role="alertdialog"][aria-modal="true"]',
        ];


        const visibleModalIsOpen =
          modalSelectors.some(
            (selector)=>
              Array.from(
                document.querySelectorAll<HTMLElement>(
                  selector,
                ),
              ).some(
                (element)=>{

                  const style =
                    window.getComputedStyle(
                      element,
                    );


                  return (
                    style.display !== "none" &&
                    style.visibility !== "hidden" &&
                    style.opacity !== "0" &&
                    element.getClientRects().length > 0
                  );

                },
              ),
          );


        if(visibleModalIsOpen) {
          return;
        }


        event.preventDefault();


        if(
          dirtyFormsRef.current.size > 0
        ) {

          showEscapeBlockedMessage();

          return;

        }


        void handleLogout();

      }


      window.addEventListener(
        "keydown",
        handleEscape,
        true,
      );


      return ()=>{

        window.removeEventListener(
          "keydown",
          handleEscape,
          true,
        );

      };

    },
  );


  return (
    <div className="app-layout app-shell">

      <aside
        className="sidebar app-rail"
        aria-label="Navigimi kryesor"
      >

        <button
          type="button"
          className="app-rail-brand"
          onClick={()=>
            navigate(
              "/dashboard",
            )
          }
          aria-label="DentalTrack — Dashboard"
          title="DentalTrack"
        >
          DT
        </button>


        <nav className="app-rail-navigation">

          {navigationItems.map(
            (item)=>(

              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive })=>
                  [
                    "app-rail-link",
                    isActive
                      ? "is-active"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
                aria-label={item.label}
                title={item.label}
              >
                {item.icon}

                <span>
                  {item.label}
                </span>
              </NavLink>

            ),
          )}

        </nav>


        <button
          type="button"
          className="app-rail-account"
          onClick={handleLogout}
          aria-label="Dil nga sesioni"
          title="Dil nga sesioni — Esc"
        >
          <span className="app-rail-account-avatar">
            {userInitials}
          </span>

          <span className="app-rail-account-label">
            Dil
          </span>

          <LogOut
            className="app-rail-account-logout"
            size={15}
            aria-hidden="true"
          />
        </button>

      </aside>


      <section className="content app-shell-content">

        <header className="topbar app-commandbar">

          <div className="app-commandbar-context">

            <span className="app-commandbar-title">
              {pageTitle}
            </span>

            {showMonthNavigator && (
              <MonthNavigator />
            )}

          </div>


          <div
          className="app-commandbar-actions"
          onClickCapture={(event)=>{

            const target =
              (
                event.target as HTMLElement
              ).closest("button");


            if(
              !target ||
              !target.classList.contains(
                "is-primary",
              )
            ) {
              return;
            }


            sessionStorage.setItem(
              "dentaltrack:open-create-work",
              "1",
            );


            if(
              location.pathname === "/works"
            ) {

              event.preventDefault();
              event.stopPropagation();

              window.dispatchEvent(
                new Event(
                  "dentaltrack:open-create-work",
                ),
              );

            }

          }}
        >

            <button
              type="button"
              className="app-command-button is-primary"
              onClick={()=>
                navigate(
                  "/works",
                )
              }
            >
              <Plus
                size={16}
                aria-hidden="true"
              />

              <span>Punë e re</span>
            </button>


            <button
              type="button"
              className="app-command-button is-accent"
              onClick={()=>
                navigate(
                  "/payments",
                )
              }
            >
              <Banknote
                size={16}
                aria-hidden="true"
              />

              <span>Pagesë</span>
            </button>

          </div>

        </header>


        <div className="app-shell-page">
          {children}
        </div>

      </section>


      {escapeMessage && (

        <AppToast
          message={escapeMessage}
          type="error"
          title="Dalja u bllokua"
          onClose={()=>
            setEscapeMessage("")
          }
        />

      )}

    </div>
  );

}
