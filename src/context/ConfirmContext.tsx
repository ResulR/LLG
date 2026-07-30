import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";


type ConfirmTone =
  "danger" |
  "warning" |
  "primary";


type ConfirmOptions = {
  title:string;
  message:string;
  confirmLabel?:string;
  cancelLabel?:string;
  tone?:ConfirmTone;
};


type ConfirmContextValue = {
  confirmAction:(
    options:ConfirmOptions,
  )=>Promise<boolean>;
};


type PendingConfirmation = {
  options:ConfirmOptions;
  resolve:(confirmed:boolean)=>void;
};


const ConfirmContext =
  createContext<ConfirmContextValue|null>(
    null,
  );


export function ConfirmProvider({
  children,
}:{
  children:React.ReactNode;
}) {

  const [
    pending,
    setPending,
  ] =
    useState<PendingConfirmation|null>(
      null,
    );

  const pendingRef =
    useRef<PendingConfirmation|null>(
      null,
    );

  const dialogRef =
    useRef<HTMLElement|null>(
      null,
    );

  const confirmButtonRef =
    useRef<HTMLButtonElement|null>(
      null,
    );


  const closeConfirmation =
    useCallback(
      (
        confirmed:boolean,
      )=>{

        const current =
          pendingRef.current;

        if(!current) {
          return;
        }

        pendingRef.current =
          null;

        setPending(null);

        current.resolve(
          confirmed,
        );

      },
      [],
    );


  const confirmAction =
    useCallback(
      (
        options:ConfirmOptions,
      )=>{

        return new Promise<boolean>(
          (resolve)=>{

            const previous =
              pendingRef.current;

            if(previous) {

              previous.resolve(
                false,
              );

            }

            const next = {
              options,
              resolve,
            };

            pendingRef.current =
              next;

            setPending(next);

          },
        );

      },
      [],
    );


  useEffect(
    ()=>{

      return ()=>{

        const current =
          pendingRef.current;

        pendingRef.current =
          null;

        current?.resolve(
          false,
        );

      };

    },
    [],
  );


  useEffect(
    ()=>{

      if(!pending) {
        return;
      }


      const previousOverflow =
        document.body.style.overflow;

      const previouslyFocused =
        document.activeElement
          instanceof HTMLElement
            ? document.activeElement
            : null;

      document.body.style.overflow =
        "hidden";


      const focusTimer =
        window.setTimeout(
          ()=>{

            confirmButtonRef
              .current
              ?.focus();

          },
          0,
        );


      function handleKeyDown(
        event:KeyboardEvent,
      ) {

        if(event.key === "Escape") {

          event.preventDefault();
          event.stopPropagation();

          closeConfirmation(
            false,
          );

          return;

        }


        if(
          event.key !== "Tab" ||
          !dialogRef.current
        ) {
          return;
        }


        const focusable =
          Array.from(
            dialogRef.current.querySelectorAll<
              HTMLButtonElement
            >(
              'button:not([disabled])',
            ),
          );


        if(focusable.length === 0) {

          event.preventDefault();
          return;

        }


        const first =
          focusable[0];

        const last =
          focusable[
            focusable.length - 1
          ];


        if(
          event.shiftKey &&
          document.activeElement === first
        ) {

          event.preventDefault();
          last.focus();

        } else if(
          !event.shiftKey &&
          document.activeElement === last
        ) {

          event.preventDefault();
          first.focus();

        }

      }


      window.addEventListener(
        "keydown",
        handleKeyDown,
        true,
      );


      return ()=>{

        window.clearTimeout(
          focusTimer,
        );

        document.body.style.overflow =
          previousOverflow;

        window.removeEventListener(
          "keydown",
          handleKeyDown,
          true,
        );

        previouslyFocused?.focus();

      };

    },
    [
      closeConfirmation,
      pending,
    ],
  );


  const tone =
    pending?.options.tone ??
    "primary";


  return (
    <ConfirmContext.Provider
      value={{
        confirmAction,
      }}
    >

      {children}


      {pending && (

        <div
          className="app-confirm-backdrop"
          role="presentation"
          onMouseDown={(event)=>{

            if(
              event.target ===
              event.currentTarget
            ) {

              closeConfirmation(
                false,
              );

            }

          }}
        >

          <section
            ref={dialogRef}
            className={
              `app-confirm-dialog is-${tone}`
            }
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="app-confirm-title"
            aria-describedby="app-confirm-message"
          >

            <button
              type="button"
              className="app-confirm-close"
              onClick={()=>
                closeConfirmation(
                  false,
                )
              }
              aria-label="Mbyll"
            >
              <X size={18} />
            </button>


            <span
              className="app-confirm-icon"
              aria-hidden="true"
            >

              {
                tone === "danger"
                  ? (
                      <AlertTriangle
                        size={25}
                      />
                    )
                  : tone === "warning"
                    ? (
                        <Info
                          size={25}
                        />
                      )
                    : (
                        <CheckCircle2
                          size={25}
                        />
                      )
              }

            </span>


            <div className="app-confirm-copy">

              <span className="app-confirm-eyebrow">
                Konfirmim
              </span>

              <h2 id="app-confirm-title">
                {pending.options.title}
              </h2>

              <p id="app-confirm-message">
                {pending.options.message}
              </p>

            </div>


            <div className="app-confirm-actions">

              <button
                type="button"
                className="app-confirm-cancel"
                onClick={()=>
                  closeConfirmation(
                    false,
                  )
                }
              >
                {
                  pending.options
                    .cancelLabel ??
                  "Anulo"
                }
              </button>


              <button
                ref={confirmButtonRef}
                type="button"
                className="app-confirm-submit"
                onClick={()=>
                  closeConfirmation(
                    true,
                  )
                }
              >
                {
                  pending.options
                    .confirmLabel ??
                  "Konfirmo"
                }
              </button>

            </div>

          </section>

        </div>

      )}

    </ConfirmContext.Provider>
  );

}


export function useConfirm() {

  const context =
    useContext(
      ConfirmContext,
    );


  if(!context) {

    throw new Error(
      "useConfirm must be used inside ConfirmProvider",
    );

  }


  return context;

}
