import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  LayoutDashboard,
  Stethoscope,
  ClipboardList,
  CreditCard,
  LogOut,
} from "lucide-react";

import {
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

  const showMonthNavigator =
    location.pathname === "/dashboard" ||
    location.pathname === "/works" ||
    location.pathname === "/payments" ||
    /^\/doctors\/[^/]+$/.test(
      location.pathname,
    );

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

  });


  return (
    <div className="app-layout">

      <aside className="sidebar">

        <div className="brand">
          DentalTrack
        </div>

        <nav>

          <a
            onClick={
              ()=>navigate(
                "/dashboard",
              )
            }
          >
            <LayoutDashboard size={18} />
            Dashboard
          </a>

          <a
            onClick={
              ()=>navigate(
                "/doctors",
              )
            }
          >
            <Stethoscope size={18} />
            Mjekët
          </a>

          <a
            onClick={
              ()=>navigate(
                "/works",
              )
            }
          >
            <ClipboardList size={18} />
            Punët
          </a>

          <a
            onClick={
              ()=>navigate(
                "/payments",
              )
            }
          >
            <CreditCard size={18} />
            Pagesat
          </a>

          <button
            type="button"
            className="logout"
            onClick={handleLogout}
            title="Dil nga sesioni — Esc"
          >
            <LogOut size={18} />

            <span>Dil</span>

            <kbd>Esc</kbd>
          </button>

        </nav>

      </aside>

      <section className="content">

        <header className="topbar">

          <div className="topbar-context">

            <span>
              Paneli kryesor
            </span>

            {showMonthNavigator && (
              <MonthNavigator />
            )}

          </div>

          <small>
            {user?.userId}
          </small>

        </header>

        {children}

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
