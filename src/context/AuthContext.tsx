import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Clock3,
  LogOut,
} from "lucide-react";

import {
  api,
} from "@/lib/api";


const IDLE_DURATION_MS =
  5 * 60 * 1000;

const WARNING_DURATION_MS =
  30 * 1000;

const HEARTBEAT_INTERVAL_MS =
  15 * 1000;

const ACTIVITY_EVENT_THROTTLE_MS =
  1000;


type User = {
  userId:string;
  sessionId:string;
  iat?:number;
  exp?:number;
};


type ServerSession = {
  id:string;
  userId:string;
  createdAt:string;
  lastActivityAt:string;
  absoluteExpiresAt:string;
  serverNow:string;
};


type ClientSession =
  ServerSession & {
    clockOffsetMs:number;
  };


type WarningReason =
  "idle" |
  "absolute";


type AuthContextType = {
  user:User | null;
  loading:boolean;
  logout:()=>Promise<void>;
  refresh:()=>Promise<void>;
};


type ChannelMessage =
  | {
      type:"SESSION_UPDATED";
      session:ClientSession;
    }
  | {
      type:"LOGOUT";
    };


const AuthContext =
  createContext<AuthContextType | null>(
    null,
  );


function normalizeSession(
  session:ServerSession,
):ClientSession {

  return {
    ...session,

    clockOffsetMs:
      new Date(
        session.serverNow,
      ).getTime()
      - Date.now(),
  };

}


function remainingSeconds(
  milliseconds:number,
) {

  return Math.max(
    0,
    Math.ceil(
      milliseconds / 1000,
    ),
  );

}


export function AuthProvider({
  children,
}:{
  children:React.ReactNode;
}) {

  const [user,setUser] =
    useState<User | null>(null);

  const [session,setSession] =
    useState<ClientSession | null>(null);

  const [loading,setLoading] =
    useState(true);

  const [
    warningReason,
    setWarningReason,
  ] =
    useState<WarningReason | null>(
      null,
    );

  const [
    warningSeconds,
    setWarningSeconds,
  ] =
    useState(30);


  const channelRef =
    useRef<BroadcastChannel | null>(
      null,
    );

  const sessionRef =
    useRef<ClientSession | null>(
      null,
    );

  const userRef =
    useRef<User | null>(
      null,
    );

  const heartbeatTimeoutRef =
    useRef<number | null>(
      null,
    );

  const lastHeartbeatRef =
    useRef(0);

  const lastActivityEventRef =
    useRef(0);

  const logoutRunningRef =
    useRef(false);


  useEffect(
    ()=>{

      sessionRef.current =
        session;

    },
    [session],
  );


  useEffect(
    ()=>{

      userRef.current =
        user;

    },
    [user],
  );


  const broadcast =
    useCallback(
      (
        message:ChannelMessage,
      )=>{

        channelRef.current?.postMessage(
          message,
        );

      },
      [],
    );


  const clearLocalSession =
    useCallback(
      (
        notifyOtherTabs:boolean,
      )=>{

        setUser(null);

        setSession(null);

        setWarningReason(null);

        setWarningSeconds(30);


        if(
          heartbeatTimeoutRef.current
          !== null
        ) {

          window.clearTimeout(
            heartbeatTimeoutRef.current,
          );

          heartbeatTimeoutRef.current =
            null;

        }


        if(notifyOtherTabs) {

          broadcast({
            type:"LOGOUT",
          });

        }

      },
      [broadcast],
    );


  const refresh =
    useCallback(
      async ()=>{

        try {

          const response =
            await api(
              "/auth/me",
            );


          if(!response.ok) {

            clearLocalSession(false);

            return;

          }


          const data =
            await response.json();


          const normalized =
            normalizeSession(
              data.session,
            );


          setUser(
            data.user,
          );

          setSession(
            normalized,
          );

          setWarningReason(null);

          broadcast({
            type:"SESSION_UPDATED",
            session:normalized,
          });


        } catch {

          clearLocalSession(false);

        }

      },
      [
        broadcast,
        clearLocalSession,
      ],
    );


  const performLogout =
    useCallback(
      async (
        notifyOtherTabs:boolean,
      )=>{

        if(logoutRunningRef.current) {
          return;
        }


        logoutRunningRef.current =
          true;


        try {

          await api(
            "/auth/logout",
            {
              method:"POST",
            },
          );


        } catch(error) {

          console.error(
            "Logout request failed",
            error,
          );


        } finally {

          clearLocalSession(
            notifyOtherTabs,
          );

          logoutRunningRef.current =
            false;

        }

      },
      [clearLocalSession],
    );


  const logout =
    useCallback(
      async ()=>{

        await performLogout(true);

      },
      [performLogout],
    );


  const sendHeartbeat =
    useCallback(
      async ()=>{

        if(!userRef.current) {
          return;
        }


        lastHeartbeatRef.current =
          Date.now();


        try {

          const response =
            await api(
              "/auth/activity",
              {
                method:"POST",
              },
            );


          if(!response.ok) {
            return;
          }


          const data =
            await response.json();


          const normalized =
            normalizeSession(
              data.session,
            );


          setSession(
            normalized,
          );

          setWarningReason(null);

          setWarningSeconds(30);

          broadcast({
            type:"SESSION_UPDATED",
            session:normalized,
          });


        } catch(error) {

          console.error(
            "Session heartbeat failed",
            error,
          );

        }

      },
      [broadcast],
    );


  const scheduleHeartbeat =
    useCallback(
      ()=>{

        if(
          !userRef.current ||
          !sessionRef.current
        ) {
          return;
        }


        const currentSession =
          sessionRef.current;

        const adjustedNow =
          Date.now()
          + currentSession.clockOffsetMs;

        const idleDeadline =
          new Date(
            currentSession.lastActivityAt,
          ).getTime()
          + IDLE_DURATION_MS;

        const idleRemaining =
          idleDeadline
          - adjustedNow;

        const elapsed =
          Date.now()
          - lastHeartbeatRef.current;


        let delay =
          Math.max(
            0,
            HEARTBEAT_INTERVAL_MS
            - elapsed,
          );


        if(
          idleRemaining
          <= WARNING_DURATION_MS
            + 15 * 1000
        ) {

          delay = 0;

        }


        if(delay === 0) {

          if(
            heartbeatTimeoutRef.current
            !== null
          ) {

            window.clearTimeout(
              heartbeatTimeoutRef.current,
            );

            heartbeatTimeoutRef.current =
              null;

          }


          void sendHeartbeat();

          return;

        }


        if(
          heartbeatTimeoutRef.current
          !== null
        ) {
          return;
        }


        heartbeatTimeoutRef.current =
          window.setTimeout(
            ()=>{

              heartbeatTimeoutRef.current =
                null;

              void sendHeartbeat();

            },
            delay,
          );

      },
      [sendHeartbeat],
    );


  const recordActivity =
    useCallback(
      ()=>{

        if(!userRef.current) {
          return;
        }


        const now =
          Date.now();


        if(
          now -
          lastActivityEventRef.current
          < ACTIVITY_EVENT_THROTTLE_MS
        ) {
          return;
        }


        lastActivityEventRef.current =
          now;


        scheduleHeartbeat();

      },
      [scheduleHeartbeat],
    );


  useEffect(
    ()=>{

      const channel =
        new BroadcastChannel(
          "dentaltrack-session",
        );


      channelRef.current =
        channel;


      channel.onmessage =
        (
          event:
            MessageEvent<ChannelMessage>,
        )=>{

          const message =
            event.data;


          if(
            message.type
            === "LOGOUT"
          ) {

            clearLocalSession(false);

            return;

          }


          if(
            message.type
            === "SESSION_UPDATED"
          ) {

            setSession(
              message.session,
            );

            setWarningReason(null);

            setWarningSeconds(30);

          }

        };


      return ()=>{

        channel.close();

        channelRef.current =
          null;

      };

    },
    [clearLocalSession],
  );


  useEffect(
    ()=>{

      const handleUnauthorized =
        ()=>{

          clearLocalSession(true);

        };


      window.addEventListener(
        "dentaltrack:unauthorized",
        handleUnauthorized,
      );


      return ()=>{

        window.removeEventListener(
          "dentaltrack:unauthorized",
          handleUnauthorized,
        );

      };

    },
    [clearLocalSession],
  );


  useEffect(
    ()=>{

      refresh()
        .finally(
          ()=>setLoading(false),
        );

    },
    [refresh],
  );


  useEffect(
    ()=>{

      if(!user) {
        return;
      }


      const events:
        Array<keyof WindowEventMap> = [
          "mousedown",
          "keydown",
          "scroll",
          "touchstart",
          "mousemove",
        ];


      for(const eventName of events) {

        window.addEventListener(
          eventName,
          recordActivity,
          {
            passive:true,
          },
        );

      }


      const handleVisibility =
        ()=>{

          if(
            document.visibilityState
            === "visible"
          ) {

            recordActivity();

          }

        };


      document.addEventListener(
        "visibilitychange",
        handleVisibility,
      );


      return ()=>{

        for(const eventName of events) {

          window.removeEventListener(
            eventName,
            recordActivity,
          );

        }


        document.removeEventListener(
          "visibilitychange",
          handleVisibility,
        );

      };

    },
    [
      recordActivity,
      user,
    ],
  );


  useEffect(
    ()=>{

      if(
        !user ||
        !session
      ) {

        setWarningReason(null);

        return;
      }


      const checkDeadlines =
        ()=>{

          const adjustedNow =
            Date.now()
            + session.clockOffsetMs;

          const idleDeadline =
            new Date(
              session.lastActivityAt,
            ).getTime()
            + IDLE_DURATION_MS;

          const absoluteDeadline =
            new Date(
              session.absoluteExpiresAt,
            ).getTime();

          const idleRemaining =
            idleDeadline
            - adjustedNow;

          const absoluteRemaining =
            absoluteDeadline
            - adjustedNow;

          const isAbsoluteFirst =
            absoluteRemaining
            <= idleRemaining;

          const nextRemaining =
            isAbsoluteFirst
              ? absoluteRemaining
              : idleRemaining;

          const nextReason:
            WarningReason =
              isAbsoluteFirst
                ? "absolute"
                : "idle";


          if(nextRemaining <= 0) {

            void performLogout(true);

            return;

          }


          if(
            nextRemaining
            <= WARNING_DURATION_MS
          ) {

            setWarningReason(
              nextReason,
            );

            setWarningSeconds(
              remainingSeconds(
                nextRemaining,
              ),
            );

            return;

          }


          setWarningReason(null);

          setWarningSeconds(30);

        };


      checkDeadlines();


      const interval =
        window.setInterval(
          checkDeadlines,
          500,
        );


      return ()=>{

        window.clearInterval(
          interval,
        );

      };

    },
    [
      performLogout,
      session,
      user,
    ],
  );


  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        logout,
        refresh,
      }}
    >
      {children}

      {
        warningReason && (
          <div
            className="session-warning-backdrop"
            role="presentation"
          >
            <section
              className="session-warning-modal"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="session-warning-title"
              aria-describedby="session-warning-description"
            >
              <div
                className="session-warning-icon"
                aria-hidden="true"
              >
                <Clock3 size={27} />
              </div>

              <span
                className="session-warning-eyebrow"
              >
                Siguria e sesionit
              </span>

              <h2
                id="session-warning-title"
              >
                Sesioni po përfundon
              </h2>

              <p
                id="session-warning-description"
              >
                Sesioni juaj do të përfundojë
                pas{" "}
                <strong>
                  {warningSeconds}
                </strong>{" "}
                sekondash.
              </p>

              {
                warningReason
                === "idle"
                  ? (
                    <p
                      className="session-warning-note"
                    >
                      Lëvizni miun, klikoni ose
                      përdorni tastierën për të
                      vazhduar sesionin.
                    </p>
                  )
                  : (
                    <p
                      className="session-warning-note"
                    >
                      Koha maksimale prej një ore
                      është arritur dhe sesioni nuk
                      mund të zgjatet.
                    </p>
                  )
              }

              <button
                type="button"
                className="session-warning-logout"
                onClick={
                  ()=>void logout()
                }
              >
                <LogOut size={18} />
                Dil tani
              </button>
            </section>
          </div>
        )
      }
    </AuthContext.Provider>
  );

}


export function useAuth() {

  const context =
    useContext(
      AuthContext,
    );


  if(!context) {

    throw new Error(
      "useAuth must be used inside AuthProvider",
    );

  }


  return context;

}
