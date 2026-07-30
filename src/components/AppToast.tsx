import {
  useEffect,
  useRef,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";


type ToastType =
  "success" |
  "error" |
  "info";


type Props = {
  message:string;
  type:ToastType;
  title?:string;
  onClose:()=>void;
  autoHideMs?:number|null;
};


export default function AppToast({
  message,
  type,
  title,
  onClose,
  autoHideMs=5000,
}:Props) {

  const onCloseRef =
    useRef(onClose);


  useEffect(
    ()=>{

      onCloseRef.current =
        onClose;

    },
    [
      onClose,
    ],
  );


  useEffect(
    ()=>{

      if(
        !message ||
        autoHideMs === null
      ) {
        return;
      }


      const timer =
        window.setTimeout(
          ()=>{

            onCloseRef.current();

          },
          autoHideMs,
        );


      return ()=>{

        window.clearTimeout(
          timer,
        );

      };

    },
    [
      autoHideMs,
      message,
    ],
  );


  if(!message) {
    return null;
  }


  const resolvedTitle =
    title ??
    (
      type === "success"
        ? "Veprimi u krye"
        : type === "error"
          ? "Veprimi dështoi"
          : "Njoftim"
    );


  return (
    <div
      className={
        `app-toast is-${type}`
      }
      role={
        type === "error"
          ? "alert"
          : "status"
      }
      aria-live={
        type === "error"
          ? "assertive"
          : "polite"
      }
    >

      <span
        className="app-toast-icon"
        aria-hidden="true"
      >
        {
          type === "success"
            ? (
                <CheckCircle2
                  size={20}
                />
              )
            : type === "error"
              ? (
                  <AlertCircle
                    size={20}
                  />
                )
              : (
                  <Info
                    size={20}
                  />
                )
        }
      </span>


      <div className="app-toast-copy">

        <strong>
          {resolvedTitle}
        </strong>

        <p>
          {message}
        </p>

      </div>


      <button
        type="button"
        className="app-toast-close"
        onClick={onClose}
        aria-label="Mbyll njoftimin"
      >
        <X size={17} />
      </button>

    </div>
  );

}
