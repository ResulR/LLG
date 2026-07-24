import {
  useState,
} from "react";

import {
  Eye,
  EyeOff,
  LockKeyhole,
  UserRound,
} from "lucide-react";

import {
  Navigate,
  useNavigate,
} from "react-router-dom";

import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";


export default function Login() {

  const navigate = useNavigate();

  const {
    refresh,
    user,
    loading:authLoading,
  } = useAuth();

  const [username,setUsername] =
    useState("");

  const [password,setPassword] =
    useState("");

  const [showPassword,setShowPassword] =
    useState(false);

  const [error,setError] =
    useState("");

  const [loading,setLoading] =
    useState(false);


  if(!authLoading && user) {

    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );

  }


  async function login(
    event:React.FormEvent,
  ) {

    event.preventDefault();

    setError("");


    const cleanUsername =
      username.trim();


    if(!cleanUsername || !password) {

      setError(
        "Plotësoni përdoruesin dhe fjalëkalimin.",
      );

      return;

    }


    setLoading(true);


    try {

      const response = await api(
        "/auth/login",
        {
          method:"POST",

          body:JSON.stringify({
            username:cleanUsername,
            password,
          }),
        },
      );


      if(!response.ok) {

        setError(
          "Përdoruesi ose fjalëkalimi nuk është i saktë.",
        );

        return;

      }


      await refresh();

      navigate(
        "/dashboard",
        {
          replace:true,
        },
      );


    } catch(error) {

      console.error(error);

      setError(
        "Gabim gjatë lidhjes me serverin.",
      );


    } finally {

      setLoading(false);

    }

  }


  return (

    <main className="login-page">

      <section className="login-card">

        <div className="login-brand">

          <span className="login-brand-icon">
            <span>DT</span>
          </span>

          <div>
            <strong>DentalTrack</strong>

            <span>
              Menaxhimi i laboratorit dentar
            </span>
          </div>

        </div>


        <div className="login-heading">

          <span className="login-eyebrow">
            Mirë se vini
          </span>

          <h1>Hyrje në sistem</h1>

          <p>
            Shkruani të dhënat tuaja për të
            vazhduar.
          </p>

        </div>


        <form
          className="login-form"
          onSubmit={login}
        >

          <label className="login-field">

            <span>Përdoruesi</span>

            <div className="login-input-wrapper">

              <UserRound
                size={18}
                aria-hidden="true"
              />

              <input
                type="text"
                value={username}
                onChange={(event)=>
                  setUsername(
                    event.target.value,
                  )
                }
                placeholder="Shkruani përdoruesin"
                autoComplete="username"
                autoFocus
                disabled={loading}
                required
              />

            </div>

          </label>


          <label className="login-field">

            <span>Fjalëkalimi</span>

            <div className="login-input-wrapper">

              <LockKeyhole
                size={18}
                aria-hidden="true"
              />

              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(event)=>
                  setPassword(
                    event.target.value,
                  )
                }
                placeholder="Shkruani fjalëkalimin"
                autoComplete="current-password"
                disabled={loading}
                required
              />


              <button
                type="button"
                className="login-password-toggle"
                onClick={()=>
                  setShowPassword(
                    (current)=>!current,
                  )
                }
                aria-label={
                  showPassword
                    ? "Fshih fjalëkalimin"
                    : "Shfaq fjalëkalimin"
                }
              >
                {
                  showPassword
                    ? <EyeOff size={18} />
                    : <Eye size={18} />
                }
              </button>

            </div>

          </label>


          {error && (

            <div
              className="login-error"
              role="alert"
            >
              {error}
            </div>

          )}


          <button
            type="submit"
            className="login-submit"
            disabled={
              loading ||
              authLoading
            }
          >
            {
              loading
                ? "Duke hyrë..."
                : "Kyçu"
            }
          </button>

        </form>


        <p className="login-footer">
          DentalTrack · Paneli i laboratorit
        </p>

      </section>

    </main>

  );

}
