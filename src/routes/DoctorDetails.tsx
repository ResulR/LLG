import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
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


function formatMoney(value:string|number) {

  return new Intl.NumberFormat(
    "de-DE",
    {
      minimumFractionDigits:2,
      maximumFractionDigits:2,
    },
  ).format(Number(value || 0));

}


function formatDate(value:string) {

  return new Date(value).toLocaleDateString(
    "sq-AL",
    {
      day:"2-digit",
      month:"2-digit",
      year:"numeric",
    },
  );

}


function getWorkNumber(work:Work) {

  return [
    work.year,
    String(work.month).padStart(2,"0"),
    String(work.monthly_number).padStart(3,"0"),
  ].join("-");

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
      return "E mbyllur globalisht";

    default:
      return "Anuluar";

  }

}


export default function DoctorDetails() {

  const {
    selectedMonth,
  } = useMonth();

  const { id } = useParams();
  const navigate = useNavigate();

  const [data,setData] =
    useState<DoctorDetailsData|null>(null);

  const [isLoading,setIsLoading] =
    useState(true);

  const [error,setError] =
    useState("");

  const [search,setSearch] =
    useState("");

  const [filter,setFilter] =
    useState("all");

  const [selectedWork,setSelectedWork] =
    useState<Work|null>(null);


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


      setData(await response.json());


    } catch(error) {

      console.error(error);

      setError(
        "Detajet e mjekut nuk mund të ngarkoheshin.",
      );


    } finally {

      setIsLoading(false);

    }

  }


  useEffect(()=>{

    loadDetails();

  },[
    id,
    selectedMonth,
  ]);


  useEffect(()=>{

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

  },[selectedWork]);


  const filteredWorks = useMemo(()=>{

    if(!data) {
      return [];
    }


    const normalizedSearch =
      search.trim().toLowerCase();


    return data.works.filter((work)=>{

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
        .includes(normalizedSearch);


      let matchesFilter = true;


      if(filter === "unpaid") {

        matchesFilter =
          work.status === "active" &&
          Number(work.remaining_amount) > 0;

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


      return matchesSearch && matchesFilter;

    });

  },[
    data,
    search,
    filter,
  ]);


  return (

    <Layout>

      <main className="doctor-detail-page">

        <button
          type="button"
          className="doctor-detail-back"
          onClick={()=>navigate(-1)}
        >
          ← Kthehu
        </button>


        {isLoading && (
          <div className="doctor-detail-loading">
            Duke ngarkuar...
          </div>
        )}


        {error && (
          <div className="doctor-detail-error">
            {error}
          </div>
        )}


        {data && (

          <>

            <header className="doctor-detail-header">

              <div className="doctor-detail-identity">

                <span className="doctor-detail-avatar">
                  {
                    data.doctor.name
                      .charAt(0)
                      .toUpperCase()
                  }
                </span>


                <div>

                  <span className="doctor-detail-eyebrow">
                    Fleta e mjekut
                  </span>

                  <h1>{data.doctor.name}</h1>

                  <p>
                    {
                      data.doctor.phone ??
                      "Nuk ka numër telefoni"
                    }
                  </p>

                </div>

              </div>


              <div className="doctor-detail-header-actions">

                <Link
                  to="/works"
                  className="doctor-detail-button is-secondary"
                >
                  ＋ Krijo punë
                </Link>

                <Link
                  to="/payments"
                  className="doctor-detail-button is-primary"
                >
                  € Regjistro pagesë
                </Link>

              </div>

            </header>


            <section className="doctor-detail-kpis">

              <article>

                <span>Totali i faturuar</span>

                <strong>
                  {
                    formatMoney(
                      data.summary.total_billed,
                    )
                  } €
                </strong>

                <small>
                  Punët aktive
                </small>

              </article>


              <article className="is-paid">

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

              </article>


              <article className="is-balance">

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

              </article>


              <article>

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

              </article>

            </section>


            <section className="doctor-detail-content">

              <article className="doctor-detail-card doctor-detail-works">

                <div className="doctor-detail-card-header">

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

                </div>


                <div className="doctor-detail-filters">

                  <div className="doctor-detail-search">

                    <span>⌕</span>

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

                  </div>


                  <select
                    value={filter}
                    onChange={(event)=>
                      setFilter(
                        event.target.value,
                      )
                    }
                  >
                    <option value="all">
                      Të gjitha
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


                <div className="doctor-detail-table-scroll">

                  <table className="doctor-detail-table">

                    <thead>

                      <tr>
                        <th>Nr.</th>
                        <th>Pacienti</th>
                        <th>Data</th>
                        <th>Materiali</th>
                        <th>Përshkrimi</th>
                        <th>Lloji</th>
                        <th>Totali</th>
                        <th>Paguar</th>
                        <th>Mbetja</th>
                        <th>Statusi</th>
                      </tr>

                    </thead>


                    <tbody>

                      {filteredWorks.map((work)=>(

                        <tr
                          key={work.id}
                          onClick={()=>
                            setSelectedWork(work)
                          }
                        >

                          <td>
                            <strong>
                              {getWorkNumber(work)}
                            </strong>
                          </td>

                          <td>
                            {work.first_name}{" "}
                            {work.last_name}
                          </td>

                          <td>
                            {formatDate(work.work_date)}
                          </td>

                          <td>
                            {work.material_name ?? "-"}
                          </td>

                          <td>
                            <span
                              className="doctor-work-table-description"
                              title={
                                work.description ??
                                "Pa përshkrim"
                              }
                            >
                              {
                                work.description ??
                                "Pa përshkrim"
                              }
                            </span>
                          </td>

                          <td>
                            {
                              work.is_repeat ? (
                                <span className="works-repeat-badge">
                                  Përsëritje
                                </span>
                              ) : (
                                <span className="works-standard-badge">
                                  E re
                                </span>
                              )
                            }
                          </td>

                          <td>
                            {
                              formatMoney(
                                work.total_amount,
                              )
                            } €
                          </td>

                          <td className="is-paid">
                            {
                              formatMoney(
                                work.paid_amount,
                              )
                            } €
                          </td>

                          <td className="is-balance">
                            <strong>
                              {
                                formatMoney(
                                  work.remaining_amount,
                                )
                              } €
                            </strong>
                          </td>

                          <td>

                            <span
                              className={
                                `doctor-work-status is-${work.payment_status}`
                              }
                            >
                              {
                                getPaymentStatusLabel(
                                  work.payment_status,
                                )
                              }
                            </span>

                          </td>

                        </tr>

                      ))}


                      {filteredWorks.length === 0 && (

                        <tr>

                          <td
                            colSpan={10}
                            className="doctor-detail-empty"
                          >
                            Nuk u gjet asnjë punë.
                          </td>

                        </tr>

                      )}

                    </tbody>

                  </table>

                </div>

              </article>


              <aside className="doctor-detail-card doctor-detail-payments">

                <div className="doctor-detail-card-header">

                  <div>
                    <h2>Pagesat</h2>

                    <p>
                      Historiku i pagesave
                    </p>
                  </div>

                </div>


                <div className="doctor-payment-list">

                  {data.payments.map((payment)=>(

                    <div
                      key={payment.id}
                      className="doctor-payment-row"
                    >

                      <div>

                        <strong>
                          {
                            formatMoney(
                              payment.amount,
                            )
                          } €
                        </strong>

                        <span>
                          {
                            payment.note ??
                            "Pa shënim"
                          }
                        </span>

                      </div>


                      <time>
                        {
                          formatDate(
                            payment.payment_date,
                          )
                        }
                      </time>

                    </div>

                  ))}


                  {data.payments.length === 0 && (

                    <div className="doctor-detail-empty">
                      Nuk ka pagesa.
                    </div>

                  )}

                </div>

              </aside>

            </section>

          </>

        )}


        {selectedWork && (

          <div
            className="doctor-work-drawer-backdrop"
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
              className="doctor-work-drawer"
              role="dialog"
              aria-modal="true"
            >

              <header>

                <div>

                  <span>Detajet e punës</span>

                  <h2>
                    {getWorkNumber(selectedWork)}
                  </h2>

                </div>


                <button
                  type="button"
                  onClick={()=>
                    setSelectedWork(null)
                  }
                >
                  ×
                </button>

              </header>


              <div className="doctor-work-drawer-body">

                <section className="doctor-work-summary-grid">

                  <div>
                    <span>Pacienti</span>

                    <strong>
                      {selectedWork.first_name}{" "}
                      {selectedWork.last_name}
                    </strong>
                  </div>


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
                    <span>
                      {
                        selectedWork.pricing_mode ===
                        "fixed_total"
                          ? "Çmimi global"
                          : "Çmimi / dhëmb"
                      }
                    </span>

                    <strong>
                      {
                        formatMoney(
                          selectedWork.pricing_mode ===
                          "fixed_total"
                            ? selectedWork.total_amount
                            : selectedWork.price_per_tooth,
                        )
                      } €
                    </strong>
                  </div>


                  <div>
                    <span>Lloji i punës</span>

                    <strong>
                      {
                        selectedWork.is_repeat
                          ? "Përsëritje"
                          : "Punë e re"
                      }
                    </strong>
                  </div>


                  <div>
                    <span>Statusi</span>

                    <strong>
                      {
                        selectedWork.status ===
                        "cancelled"
                          ? "Anuluar"
                          : "Aktive"
                      }
                    </strong>
                  </div>

                </section>


                <section className="doctor-work-description">

                  <h3>Përshkrimi i punës</h3>

                  <p>
                    {
                      selectedWork.description ??
                      "Pa përshkrim"
                    }
                  </p>

                </section>


                <section className="doctor-work-finance">

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
                          selectedWork
                            .remaining_amount,
                        )
                      } €
                    </strong>
                  </div>

                </section>


                <section className="doctor-work-teeth">

                  <div className="doctor-work-section-title">

                    <h3>Dhëmbët</h3>

                    <span>
                      {
                        selectedWork.teeth.length
                      } gjithsej
                    </span>

                  </div>


                  <div className="doctor-work-teeth-list">

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


                  <div className="doctor-work-legend">

                    <span>
                      <i />
                      Normal
                    </span>

                    <span>
                      <i className="is-antar" />
                      Antar
                    </span>

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
