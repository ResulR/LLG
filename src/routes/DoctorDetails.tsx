import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Layers3,
  Phone,
  Plus,
  Search,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import Layout from "@/components/Layout";
import { useMonth } from "@/context/MonthContext";
import { api } from "@/lib/api";


type Doctor = {
  id:string;
  name:string;
  phone:string|null;
  active:boolean;
  created_at:string;
};


type Summary = {
  total_billed:string;
  total_paid:string;
  outstanding_balance:string;
  active_work_count:number;
  total_work_count:number;
  payment_count:number;
};


type Tooth = {
  number:number;
  is_antar:boolean;
};


type Work = {
  id:string;
  year:number;
  month:number;
  monthly_number:number;
  work_date:string;
  description:string|null;
  is_repeat:boolean;
  pricing_mode:"per_tooth"|"fixed_total";
  price_per_tooth:string;
  total_amount:string;
  paid_amount:string;
  remaining_amount:string;
  status:"active"|"cancelled";
  payment_status:
    | "paid"
    | "partial"
    | "unpaid"
    | "closed_global"
    | "cancelled";
  first_name:string;
  last_name:string;
  material_name:string|null;
  color_name:string|null;
  teeth:Tooth[];
};


type Payment = {
  id:string;
  amount:string;
  payment_date:string;
  note:string|null;
};


type DoctorDetailsData = {
  doctor:Doctor;
  summary:Summary;
  works:Work[];
  payments:Payment[];
};


type WorkspaceTab =
  "works" |
  "payments";


function formatMoney(
  value:string|number,
) {

  return new Intl.NumberFormat(
    "de-DE",
    {
      minimumFractionDigits:2,
      maximumFractionDigits:2,
    },
  ).format(
    Number(value || 0),
  );

}


function formatDate(
  value:string,
) {

  const normalizedValue =
    /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T12:00:00`
      : value;

  const date =
    new Date(normalizedValue);


  if(Number.isNaN(date.getTime())) {
    return value;
  }


  return date.toLocaleDateString(
    "sq-AL",
    {
      day:"2-digit",
      month:"2-digit",
      year:"numeric",
    },
  );

}


function getWorkNumber(
  work:Work,
) {

  return [
    work.year,
    String(work.month).padStart(2,"0"),
    String(work.monthly_number).padStart(3,"0"),
  ].join("-");

}


function getInitials(
  name:string,
) {

  const parts =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean);


  if(parts.length === 0) {
    return "DR";
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

}


function getPaymentStatusLabel(
  status:Work["payment_status"],
) {

  switch(status) {

    case "paid":
      return "E paguar";

    case "partial":
      return "Pjesërisht";

    case "unpaid":
      return "E papaguar";

    case "closed_global":
      return "Mbyllur globalisht";

    default:
      return "Anuluar";

  }

}


function getPaymentStatusClass(
  status:Work["payment_status"],
) {

  switch(status) {

    case "paid":
    case "closed_global":
      return "is-paid";

    case "partial":
      return "is-partial";

    case "unpaid":
      return "is-unpaid";

    default:
      return "is-cancelled";

  }

}


export default function DoctorDetails() {

  const {
    selectedMonth,
  } =
    useMonth();

  const {
    id,
  } =
    useParams();

  const navigate =
    useNavigate();

  const [
    data,
    setData,
  ] =
    useState<DoctorDetailsData|null>(
      null,
    );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    filter,
    setFilter,
  ] =
    useState("all");

  const [
    selectedWork,
    setSelectedWork,
  ] =
    useState<Work|null>(
      null,
    );

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<WorkspaceTab>(
      "works",
    );


  async function loadDetails() {

    setIsLoading(true);
    setError("");


    try {

      const response =
        await api(
          `/doctors/${id}/details?month=${encodeURIComponent(
            selectedMonth,
          )}`,
        );


      if(!response.ok) {

        throw new Error(
          "doctor_details_failed",
        );

      }


      setData(
        await response.json(),
      );


    } catch(error) {

      console.error(error);

      setError(
        "Detajet e mjekut nuk mund të ngarkoheshin.",
      );


    } finally {

      setIsLoading(false);

    }

  }


  useEffect(
    ()=>{

      void loadDetails();

    },
    [
      id,
      selectedMonth,
    ],
  );


  useEffect(
    ()=>{

      if(!selectedWork) {
        return;
      }


      const previousOverflow =
        document.body.style.overflow;

      document.body.style.overflow =
        "hidden";


      function handleEscape(
        event:KeyboardEvent,
      ) {

        if(event.key === "Escape") {
          setSelectedWork(null);
        }

      }


      window.addEventListener(
        "keydown",
        handleEscape,
      );


      return ()=>{

        document.body.style.overflow =
          previousOverflow;

        window.removeEventListener(
          "keydown",
          handleEscape,
        );

      };

    },
    [
      selectedWork,
    ],
  );


  const filteredWorks =
    useMemo(
      ()=>{

        if(!data) {
          return [];
        }


        const normalizedSearch =
          search
            .trim()
            .toLowerCase();


        return data.works.filter(
          (work)=>{

            const matchesSearch = [
              getWorkNumber(work),
              work.first_name,
              work.last_name,
              work.material_name ?? "",
              work.color_name ?? "",
              work.description ?? "",
            ]
              .join(" ")
              .toLowerCase()
              .includes(
                normalizedSearch,
              );


            let matchesFilter =
              true;


            if(filter === "unpaid") {

              matchesFilter =
                work.status === "active" &&
                Number(
                  work.remaining_amount,
                ) > 0;

            }


            if(filter === "paid") {

              matchesFilter =
                work.payment_status === "paid" ||
                work.payment_status ===
                  "closed_global";

            }


            if(filter === "active") {

              matchesFilter =
                work.status === "active";

            }


            if(filter === "cancelled") {

              matchesFilter =
                work.status === "cancelled";

            }


            return (
              matchesSearch &&
              matchesFilter
            );

          },
        );

      },
      [
        data,
        search,
        filter,
      ],
    );


  const paymentProgress =
    useMemo(
      ()=>{

        if(!data) {
          return 0;
        }


        const billed =
          Math.max(
            Number(
              data.summary.total_billed,
            ),
            0,
          );

        const outstanding =
          Math.max(
            Number(
              data.summary
                .outstanding_balance,
            ),
            0,
          );


        if(billed <= 0) {

          return outstanding <= 0
            ? 100
            : 0;

        }


        const settledAmount =
          Math.max(
            billed - outstanding,
            0,
          );


        return Math.min(
          Math.max(
            (
              settledAmount /
              billed
            ) * 100,
            0,
          ),
          100,
        );

      },
      [
        data,
      ],
    );


  return (

    <Layout>

      <main className="doctor-workspace">

        <button
          type="button"
          className="doctor-workspace-back"
          onClick={()=>
            navigate("/doctors")
          }
        >
          <ArrowLeft
            size={15}
            aria-hidden="true"
          />

          Mjekët
        </button>


        {isLoading && (

          <section className="doctor-workspace-state">
            Duke ngarkuar...
          </section>

        )}


        {error && (

          <section
            className="doctor-workspace-state is-error"
            role="alert"
          >
            <strong>
              Të dhënat nuk u ngarkuan
            </strong>

            <span>{error}</span>

            <button
              type="button"
              onClick={()=>
                void loadDetails()
              }
            >
              Provo përsëri
            </button>
          </section>

        )}


        {data && (

          <>

            <header className="doctor-workspace-hero">

              <div className="doctor-workspace-profile">

                <span className="doctor-workspace-avatar">
                  {getInitials(
                    data.doctor.name,
                  )}
                </span>


                <div>

                  <div className="doctor-workspace-profile-meta">

                    <span
                      className={
                        data.doctor.active
                          ? "doctor-workspace-status is-active"
                          : "doctor-workspace-status is-inactive"
                      }
                    >
                      {
                        data.doctor.active
                          ? "Aktiv"
                          : "Jo aktiv"
                      }
                    </span>

                    <span>
                      Kartela e mjekut
                    </span>

                  </div>


                  <h1>
                    {data.doctor.name}
                  </h1>


                  <p>

                    <Phone
                      size={14}
                      aria-hidden="true"
                    />

                    {
                      data.doctor.phone ??
                      "Nuk ka numër telefoni"
                    }

                  </p>

                </div>

              </div>


              <div className="doctor-workspace-actions">

                <button
                  type="button"
                  className="is-secondary"
                  onClick={()=>
                    navigate("/works")
                  }
                >
                  <Plus
                    size={15}
                    aria-hidden="true"
                  />

                  Krijo punë
                </button>


                <button
                  type="button"
                  className="is-primary"
                  onClick={()=>
                    navigate("/payments")
                  }
                >
                  <Banknote
                    size={15}
                    aria-hidden="true"
                  />

                  Regjistro pagesë
                </button>

              </div>

            </header>


            <section className="doctor-workspace-finance">

              <article className="is-billed">

                <div>

                  <span>Totali i faturuar</span>

                  <strong>
                    {
                      formatMoney(
                        data.summary.total_billed,
                      )
                    } €
                  </strong>

                </div>

                <BriefcaseBusiness
                  size={21}
                  aria-hidden="true"
                />

              </article>


              <article className="is-paid">

                <div>

                  <span>Totali i paguar</span>

                  <strong>
                    {
                      formatMoney(
                        data.summary.total_paid,
                      )
                    } €
                  </strong>

                  <small>
                    {
                      data.summary.payment_count
                    } pagesa
                  </small>

                </div>

                <CheckCircle2
                  size={21}
                  aria-hidden="true"
                />

              </article>


              <article className="is-balance">

                <div>

                  <span>Mbetja</span>

                  <strong>
                    {
                      formatMoney(
                        data.summary
                          .outstanding_balance,
                      )
                    } €
                  </strong>

                  <small>
                    Për t'u paguar
                  </small>

                </div>

                <CircleDollarSign
                  size={21}
                  aria-hidden="true"
                />

              </article>


              <article className="is-works">

                <div>

                  <span>Punët</span>

                  <strong>
                    {
                      data.summary.total_work_count
                    }
                  </strong>

                  <small>
                    {
                      data.summary.active_work_count
                    } aktive
                  </small>

                </div>

                <Layers3
                  size={21}
                  aria-hidden="true"
                />

              </article>

            </section>


            <section className="doctor-workspace-progress">

              <div>

                <span>
                  Progresi i pagesave
                </span>

                <strong>
                  {
                    paymentProgress.toFixed(0)
                  }%
                </strong>

              </div>


              <span className="doctor-workspace-progress-track">

                <i
                  style={{
                    width:
                      `${paymentProgress}%`,
                  }}
                />

              </span>

            </section>


            <section className="doctor-workspace-main">

              <article className="doctor-workspace-panel">

                <nav
                  className="doctor-workspace-tabs"
                  aria-label="Përmbajtja e kartelës"
                >

                  <button
                    type="button"
                    className={
                      activeTab === "works"
                        ? "is-active"
                        : ""
                    }
                    onClick={()=>
                      setActiveTab("works")
                    }
                  >
                    <BriefcaseBusiness
                      size={15}
                      aria-hidden="true"
                    />

                    Punët

                    <span>
                      {data.works.length}
                    </span>
                  </button>


                  <button
                    type="button"
                    className={
                      activeTab === "payments"
                        ? "is-active"
                        : ""
                    }
                    onClick={()=>
                      setActiveTab("payments")
                    }
                  >
                    <Banknote
                      size={15}
                      aria-hidden="true"
                    />

                    Pagesat

                    <span>
                      {data.payments.length}
                    </span>
                  </button>

                </nav>


                {activeTab === "works" && (

                  <>

                    <header className="doctor-workspace-panel-header">

                      <div>

                        <h2>Historiku i punëve</h2>

                        <p>
                          {
                            filteredWorks.length
                          } nga{" "}
                          {
                            data.works.length
                          } punë
                        </p>

                      </div>

                    </header>


                    <div className="doctor-workspace-toolbar">

                      <label className="doctor-workspace-search">

                        <Search
                          size={16}
                          aria-hidden="true"
                        />

                        <input
                          type="search"
                          value={search}
                          onChange={(event)=>
                            setSearch(
                              event.target.value,
                            )
                          }
                          placeholder="Kërko pacientin ose numrin..."
                        />

                      </label>


                      <select
                        value={filter}
                        onChange={(event)=>
                          setFilter(
                            event.target.value,
                          )
                        }
                      >
                        <option value="all">
                          Të gjitha punët
                        </option>

                        <option value="unpaid">
                          Të papaguara
                        </option>

                        <option value="paid">
                          Të paguara
                        </option>

                        <option value="active">
                          Aktive
                        </option>

                        <option value="cancelled">
                          Anuluar
                        </option>
                      </select>

                    </div>


                    <div className="doctor-workspace-list">

                      {filteredWorks.map(
                        (work)=>(

                          <button
                            key={work.id}
                            type="button"
                            className="doctor-workspace-work"
                            onClick={()=>
                              setSelectedWork(work)
                            }
                          >

                            <span className="doctor-workspace-work-icon">

                              <FileText
                                size={17}
                                aria-hidden="true"
                              />

                            </span>


                            <span className="doctor-workspace-work-identity">

                              <strong>
                                {
                                  getWorkNumber(work)
                                }
                              </strong>

                              <span>
                                {work.first_name}{" "}
                                {work.last_name}
                              </span>

                              <small>

                                <CalendarDays
                                  size={11}
                                  aria-hidden="true"
                                />

                                {
                                  formatDate(
                                    work.work_date,
                                  )
                                }

                                {
                                  work.material_name &&
                                  ` · ${work.material_name}`
                                }

                                {
                                  work.color_name &&
                                  ` · ${work.color_name}`
                                }

                              </small>

                            </span>


                            <span className="doctor-workspace-work-money">

                              <small>Totali</small>

                              <strong>
                                {
                                  formatMoney(
                                    work.total_amount,
                                  )
                                } €
                              </strong>

                            </span>


                            <span className="doctor-workspace-work-money is-paid">

                              <small>Paguar</small>

                              <strong>
                                {
                                  formatMoney(
                                    work.paid_amount,
                                  )
                                } €
                              </strong>

                            </span>


                            <span className="doctor-workspace-work-money is-balance">

                              <small>Mbetja</small>

                              <strong>
                                {
                                  formatMoney(
                                    work.remaining_amount,
                                  )
                                } €
                              </strong>

                            </span>


                            <span
                              className={
                                `doctor-workspace-payment-status ${getPaymentStatusClass(
                                  work.payment_status,
                                )}`
                              }
                            >
                              {
                                getPaymentStatusLabel(
                                  work.payment_status,
                                )
                              }
                            </span>


                            <ArrowRight
                              className="doctor-workspace-work-arrow"
                              size={15}
                              aria-hidden="true"
                            />

                          </button>

                        ),
                      )}


                      {filteredWorks.length === 0 && (

                        <div className="doctor-workspace-empty">

                          <BriefcaseBusiness
                            size={27}
                            aria-hidden="true"
                          />

                          <strong>
                            Nuk u gjet asnjë punë
                          </strong>

                          <span>
                            Ndryshoni kërkimin ose filtrin.
                          </span>

                        </div>

                      )}

                    </div>

                  </>

                )}


                {activeTab === "payments" && (

                  <>

                    <header className="doctor-workspace-panel-header">

                      <div>

                        <h2>Historiku i pagesave</h2>

                        <p>
                          {
                            data.payments.length
                          } pagesa të regjistruara
                        </p>

                      </div>


                      <button
                        type="button"
                        onClick={()=>
                          navigate("/payments")
                        }
                      >
                        Regjistro pagesë

                        <ArrowRight
                          size={14}
                          aria-hidden="true"
                        />
                      </button>

                    </header>


                    <div className="doctor-workspace-payments">

                      {data.payments.map(
                        (payment)=>(

                          <article
                            key={payment.id}
                            className="doctor-workspace-payment"
                          >

                            <span>

                              <Banknote
                                size={17}
                                aria-hidden="true"
                              />

                            </span>


                            <div>

                              <strong>
                                {
                                  formatMoney(
                                    payment.amount,
                                  )
                                } €
                              </strong>

                              <p>
                                {
                                  payment.note ??
                                  "Pa shënim"
                                }
                              </p>

                            </div>


                            <time>
                              {
                                formatDate(
                                  payment.payment_date,
                                )
                              }
                            </time>

                          </article>

                        ),
                      )}


                      {data.payments.length === 0 && (

                        <div className="doctor-workspace-empty">

                          <Banknote
                            size={27}
                            aria-hidden="true"
                          />

                          <strong>
                            Nuk ka pagesa
                          </strong>

                          <span>
                            Nuk është regjistruar asnjë pagesë për këtë muaj.
                          </span>

                        </div>

                      )}

                    </div>

                  </>

                )}

              </article>


              <aside className="doctor-workspace-summary">

                <div>

                  <span className="doctor-workspace-summary-icon">

                    <UserRound
                      size={18}
                      aria-hidden="true"
                    />

                  </span>

                  <h2>Përmbledhje</h2>

                </div>


                <dl>

                  <div>
                    <dt>Statusi</dt>

                    <dd>
                      {
                        data.doctor.active
                          ? "Aktiv"
                          : "Jo aktiv"
                      }
                    </dd>
                  </div>


                  <div>
                    <dt>Punë aktive</dt>

                    <dd>
                      {
                        data.summary
                          .active_work_count
                      }
                    </dd>
                  </div>


                  <div>
                    <dt>Pagesa</dt>

                    <dd>
                      {
                        data.summary.payment_count
                      }
                    </dd>
                  </div>


                  <div>
                    <dt>Mbetja</dt>

                    <dd className="is-balance">
                      {
                        formatMoney(
                          data.summary
                            .outstanding_balance,
                        )
                      } €
                    </dd>
                  </div>

                </dl>


                <button
                  type="button"
                  onClick={()=>
                    navigate("/payments")
                  }
                >
                  Menaxho pagesat

                  <ArrowRight
                    size={14}
                    aria-hidden="true"
                  />
                </button>

              </aside>

            </section>

          </>

        )}


        {selectedWork && (

          <div
            className="doctor-workspace-drawer-backdrop"
            role="presentation"
            onMouseDown={(event)=>{

              if(
                event.target ===
                event.currentTarget
              ) {
                setSelectedWork(null);
              }

            }}
          >

            <aside
              className="doctor-workspace-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="doctor-workspace-drawer-title"
            >

              <header>

                <div>

                  <span>Detajet e punës</span>

                  <h2 id="doctor-workspace-drawer-title">
                    {getWorkNumber(selectedWork)}
                  </h2>

                  <p>
                    {selectedWork.first_name}{" "}
                    {selectedWork.last_name}
                  </p>

                </div>


                <button
                  type="button"
                  onClick={()=>
                    setSelectedWork(null)
                  }
                  aria-label="Mbyll"
                >
                  <X
                    size={18}
                    aria-hidden="true"
                  />
                </button>

              </header>


              <div className="doctor-workspace-drawer-body">

                <section className="doctor-workspace-drawer-finance">

                  <div>
                    <span>Totali</span>

                    <strong>
                      {
                        formatMoney(
                          selectedWork.total_amount,
                        )
                      } €
                    </strong>
                  </div>


                  <div className="is-paid">
                    <span>Paguar</span>

                    <strong>
                      {
                        formatMoney(
                          selectedWork.paid_amount,
                        )
                      } €
                    </strong>
                  </div>


                  <div className="is-balance">
                    <span>Mbetja</span>

                    <strong>
                      {
                        formatMoney(
                          selectedWork.remaining_amount,
                        )
                      } €
                    </strong>
                  </div>

                </section>


                <section className="doctor-workspace-drawer-grid">

                  <div>
                    <span>Data</span>

                    <strong>
                      {
                        formatDate(
                          selectedWork.work_date,
                        )
                      }
                    </strong>
                  </div>


                  <div>
                    <span>Materiali</span>

                    <strong>
                      {
                        selectedWork.material_name ??
                        "-"
                      }
                    </strong>
                  </div>


                  <div>
                    <span>Ngjyra</span>

                    <strong>
                      {
                        selectedWork.color_name ??
                        "-"
                      }
                    </strong>
                  </div>


                  <div>
                    <span>Lloji</span>

                    <strong>
                      {
                        selectedWork.is_repeat
                          ? "Përsëritje"
                          : "Punë e re"
                      }
                    </strong>
                  </div>


                  <div>
                    <span>Mënyra e çmimit</span>

                    <strong>
                      {
                        selectedWork.pricing_mode ===
                        "fixed_total"
                          ? "Çmim total"
                          : "Për dhëmb"
                      }
                    </strong>
                  </div>


                  <div>
                    <span>Statusi</span>

                    <strong>
                      {
                        getPaymentStatusLabel(
                          selectedWork.payment_status,
                        )
                      }
                    </strong>
                  </div>

                </section>


                <section className="doctor-workspace-drawer-description">

                  <h3>Përshkrimi</h3>

                  <p>
                    {
                      selectedWork.description ??
                      "Pa përshkrim"
                    }
                  </p>

                </section>


                <section className="doctor-workspace-drawer-teeth">

                  <header>

                    <h3>Dhëmbët</h3>

                    <span>
                      {
                        selectedWork.teeth.length
                      } gjithsej
                    </span>

                  </header>


                  <div>

                    {selectedWork.teeth.map(
                      (tooth)=>(

                        <span
                          key={tooth.number}
                          className={
                            tooth.is_antar
                              ? "is-antar"
                              : ""
                          }
                        >
                          {tooth.number}

                          {tooth.is_antar && (
                            <strong>×</strong>
                          )}
                        </span>

                      ),
                    )}

                  </div>

                </section>

              </div>


              <footer>

                <button
                  type="button"
                  onClick={()=>
                    setSelectedWork(null)
                  }
                >
                  Mbyll
                </button>

              </footer>

            </aside>

          </div>

        )}

      </main>

    </Layout>

  );

}
