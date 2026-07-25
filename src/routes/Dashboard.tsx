import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import Layout from "@/components/Layout";
import { useMonth } from "@/context/MonthContext";
import { api } from "@/lib/api";


type Overview = {
  active_doctors:number;
  active_works:number;
  total_billed:string;
  total_paid:string;
  outstanding_balance:string;
};


type Receivable = {
  doctor_id:string;
  doctor_name:string;
  total_billed:string;
  total_paid:string;
  outstanding_balance:string;
  oldest_unpaid_date:string|null;
  days_outstanding:number;
  unpaid_work_count:number;
};


type RecentWork = {
  id:string;
  doctor_id?:string;
  year:number;
  month:number;
  monthly_number:number;
  work_date:string;
  description:string|null;
  is_repeat:boolean;
  total_amount:string;
  status:"active"|"cancelled";
  doctor_name:string;
  first_name:string;
  last_name:string;
};


type RecentPayment = {
  id:string;
  doctor_id?:string;
  amount:string;
  payment_date:string;
  note:string|null;
  doctor_name:string;
};


type DashboardData = {
  overview:Overview;
  receivables:Receivable[];
  recent_works:RecentWork[];
  recent_payments:RecentPayment[];
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


function getWorkNumber(work:RecentWork) {

  return [
    work.year,
    String(work.month).padStart(2,"0"),
    String(work.monthly_number).padStart(3,"0"),
  ].join("-");

}


function getDebtStatus(days:number) {

  if(days > 30) {

    return {
      label:"Me vonesë",
      className:"is-overdue",
    };

  }


  if(days > 14) {

    return {
      label:"Për t'u ndjekur",
      className:"is-watch",
    };

  }


  return {
    label:"E re",
    className:"is-new",
  };

}


export default function Dashboard() {

  const navigate = useNavigate();

  const {
    selectedMonth,
  } = useMonth();

  const [data,setData] =
    useState<DashboardData|null>(null);

  const [isLoading,setIsLoading] =
    useState(true);

  const [error,setError] =
    useState("");

  const [search,setSearch] =
    useState("");

  const [ageFilter,setAgeFilter] =
    useState("all");


  async function loadDashboard() {

    setIsLoading(true);
    setError("");


    try {

      const response =
        await api(
          `/dashboard?month=${encodeURIComponent(
            selectedMonth,
          )}`,
        );


      if(!response.ok) {

        throw new Error(
          "dashboard_load_failed",
        );

      }


      setData(await response.json());


    } catch(error) {

      console.error(error);

      setError(
        "Të dhënat nuk mund të ngarkoheshin.",
      );


    } finally {

      setIsLoading(false);

    }

  }


  useEffect(()=>{

    loadDashboard();

  },[
    selectedMonth,
  ]);


  const filteredReceivables = useMemo(()=>{

    if(!data) {
      return [];
    }


    const normalizedSearch =
      search.trim().toLowerCase();


    return data.receivables.filter(
      (receivable)=>{

        const matchesSearch =
          receivable.doctor_name
            .toLowerCase()
            .includes(normalizedSearch);


        let matchesAge = true;


        if(ageFilter === "new") {

          matchesAge =
            receivable.days_outstanding <= 14;

        }


        if(ageFilter === "watch") {

          matchesAge =
            receivable.days_outstanding > 14 &&
            receivable.days_outstanding <= 30;

        }


        if(ageFilter === "overdue") {

          matchesAge =
            receivable.days_outstanding > 30;

        }


        return matchesSearch && matchesAge;

      },
    );

  },[
    data,
    search,
    ageFilter,
  ]);


  return (

    <Layout>

      <main className="simple-dashboard">

        <header className="simple-dashboard-header">

          <div>

            <span className="simple-dashboard-eyebrow">
              Pamje e përgjithshme
            </span>

            <h1>Dashboard</h1>

            <p>
              Informacioni kryesor i laboratorit
              në një vend.
            </p>

          </div>


          <button
            type="button"
            className="simple-dashboard-refresh"
            onClick={loadDashboard}
            disabled={isLoading}
          >
            ↻ Rifresko
          </button>

        </header>


        {error && (
          <div className="simple-dashboard-message">
            {error}
          </div>
        )}


        {isLoading && !data && (
          <div className="simple-dashboard-loading">
            Duke ngarkuar...
          </div>
        )}


        {data && (

          <>

            <section className="simple-dashboard-kpis">

              <article className="simple-dashboard-kpi is-billed">

                <span className="simple-dashboard-kpi-icon">
                  €
                </span>

                <div>
                  <span>Totali i faturuar</span>

                  <strong>
                    {
                      formatMoney(
                        data.overview.total_billed,
                      )
                    } €
                  </strong>

                  <small>Punët aktive</small>
                </div>

              </article>


              <article className="simple-dashboard-kpi is-paid">

                <span className="simple-dashboard-kpi-icon">
                  ✓
                </span>

                <div>
                  <span>Totali i paguar</span>

                  <strong>
                    {
                      formatMoney(
                        data.overview.total_paid,
                      )
                    } €
                  </strong>

                  <small>
                    Pagesat e regjistruara
                  </small>
                </div>

              </article>


              <article className="simple-dashboard-kpi is-balance">

                <span className="simple-dashboard-kpi-icon">
                  !
                </span>

                <div>
                  <span>Për t'u paguar</span>

                  <strong>
                    {
                      formatMoney(
                        data.overview
                          .outstanding_balance,
                      )
                    } €
                  </strong>

                  <small>
                    {
                      data.receivables.length
                    } mjekë me detyrim
                  </small>
                </div>

              </article>


              <article className="simple-dashboard-kpi is-works">

                <span className="simple-dashboard-kpi-icon">
                  #
                </span>

                <div>
                  <span>Punë aktive</span>

                  <strong>
                    {data.overview.active_works}
                  </strong>

                  <small>
                    {
                      data.overview.active_doctors
                    } mjekë aktivë
                  </small>
                </div>

              </article>

            </section>


            <section className="simple-dashboard-main">

              <article className="simple-dashboard-card simple-dashboard-debts">

                <div className="simple-dashboard-card-header">

                  <div>

                    <h2>Detyrimet e hapura</h2>

                    <p>
                      Klikoni mbi mjekun për
                      të parë detajet.
                    </p>

                  </div>


                  <Link
                    to="/payments"
                    className="simple-dashboard-link"
                  >
                    Shiko pagesat
                  </Link>

                </div>


                <div className="simple-dashboard-debt-filters">

                  <div className="simple-dashboard-debt-search">

                    <span>⌕</span>

                    <input
                      type="search"
                      value={search}
                      onChange={(event)=>
                        setSearch(
                          event.target.value,
                        )
                      }
                      placeholder="Kërko mjekun..."
                    />

                  </div>


                  <select
                    value={ageFilter}
                    onChange={(event)=>
                      setAgeFilter(
                        event.target.value,
                      )
                    }
                  >
                    <option value="all">
                      Të gjitha
                    </option>

                    <option value="new">
                      0–14 ditë
                    </option>

                    <option value="watch">
                      15–30 ditë
                    </option>

                    <option value="overdue">
                      Mbi 30 ditë
                    </option>
                  </select>

                </div>


                <div className="simple-dashboard-table-scroll">

                  <table className="simple-dashboard-table">

                    <thead>

                      <tr>
                        <th>Mjeku</th>
                        <th>Faturuar</th>
                        <th>Paguar</th>
                        <th>Mbetja</th>
                        <th>Puna më e vjetër</th>
                        <th>Ditë</th>
                        <th>Statusi</th>
                      </tr>

                    </thead>


                    <tbody>

                      {filteredReceivables.map(
                        (receivable)=>{

                          const status =
                            getDebtStatus(
                              receivable
                                .days_outstanding,
                            );


                          return (

                            <tr
                              key={receivable.doctor_id}
                              className="simple-dashboard-clickable-row"
                              tabIndex={0}
                              onClick={()=>
                                navigate(
                                  `/doctors/${receivable.doctor_id}`,
                                )
                              }
                              onKeyDown={(event)=>{

                                if(
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {

                                  navigate(
                                    `/doctors/${receivable.doctor_id}`,
                                  );

                                }

                              }}
                            >

                              <td>

                                <div className="simple-dashboard-doctor">

                                  <span>
                                    {
                                      receivable
                                        .doctor_name
                                        .charAt(0)
                                        .toUpperCase()
                                    }
                                  </span>

                                  <div>

                                    <strong>
                                      {
                                        receivable
                                          .doctor_name
                                      }
                                    </strong>

                                    <small>
                                      {
                                        receivable
                                          .unpaid_work_count
                                      } punë të hapura
                                    </small>

                                  </div>

                                </div>

                              </td>


                              <td>
                                {
                                  formatMoney(
                                    receivable
                                      .total_billed,
                                  )
                                } €
                              </td>


                              <td className="is-paid">
                                {
                                  formatMoney(
                                    receivable
                                      .total_paid,
                                  )
                                } €
                              </td>


                              <td className="is-balance">
                                <strong>
                                  {
                                    formatMoney(
                                      receivable
                                        .outstanding_balance,
                                    )
                                  } €
                                </strong>
                              </td>


                              <td>
                                {
                                  receivable
                                    .oldest_unpaid_date
                                    ? formatDate(
                                        receivable
                                          .oldest_unpaid_date,
                                      )
                                    : "-"
                                }
                              </td>


                              <td>
                                <strong>
                                  {
                                    receivable
                                      .days_outstanding
                                  }
                                </strong>
                              </td>


                              <td>

                                <span
                                  className={
                                    `simple-dashboard-debt-status ${status.className}`
                                  }
                                >
                                  {status.label}
                                </span>

                              </td>

                            </tr>

                          );

                        },
                      )}


                      {filteredReceivables.length === 0 && (

                        <tr>

                          <td
                            colSpan={7}
                            className="simple-dashboard-empty"
                          >
                            Nuk u gjet asnjë detyrim.
                          </td>

                        </tr>

                      )}

                    </tbody>

                  </table>

                </div>

              </article>


              <aside className="simple-dashboard-actions">

                <h2>Veprime të shpejta</h2>

                <p>
                  Shkoni direkt te veprimi që
                  ju nevojitet.
                </p>


                <Link
                  to="/works"
                  className="simple-dashboard-action is-work"
                >
                  <span>＋</span>

                  <div>
                    <strong>Krijo punë</strong>
                    <small>Shto një punë të re</small>
                  </div>

                  <b>→</b>
                </Link>


                <Link
                  to="/payments"
                  className="simple-dashboard-action is-payment"
                >
                  <span>€</span>

                  <div>
                    <strong>Regjistro pagesë</strong>
                    <small>Shto pagesën e një mjeku</small>
                  </div>

                  <b>→</b>
                </Link>


                <Link
                  to="/doctors"
                  className="simple-dashboard-action is-doctor"
                >
                  <span>+</span>

                  <div>
                    <strong>Menaxho mjekët</strong>
                    <small>Shiko ose ndrysho mjekët</small>
                  </div>

                  <b>→</b>
                </Link>

              </aside>

            </section>


            <section className="simple-dashboard-bottom">

              <article className="simple-dashboard-card">

                <div className="simple-dashboard-card-header">

                  <div>
                    <h2>Punët e fundit</h2>
                    <p>Pesë punët më të fundit.</p>
                  </div>

                  <Link
                    to="/works"
                    className="simple-dashboard-link"
                  >
                    Shiko të gjitha
                  </Link>

                </div>


                <div className="simple-dashboard-list">

                  {data.recent_works.map((work)=>(

                    <div
                      key={work.id}
                      className="simple-dashboard-list-row"
                    >

                      <div>
                        <div className="simple-dashboard-work-title">

                          <strong>{getWorkNumber(work)}</strong>

                          {work.is_repeat && (
                            <span className="works-repeat-badge">
                              Përsëritje
                            </span>
                          )}

                        </div>

                        <span>
                          {work.first_name}{" "}
                          {work.last_name}
                        </span>

                        <small
                          className="simple-dashboard-work-description"
                          title={
                            work.description ??
                            "Pa përshkrim"
                          }
                        >
                          {
                            work.description ??
                            "Pa përshkrim"
                          }
                        </small>
                      </div>


                      <div>
                        <strong>{work.doctor_name}</strong>

                        <span>
                          {formatDate(work.work_date)}
                        </span>
                      </div>


                      <div className="simple-dashboard-row-end">

                        <strong>
                          {
                            formatMoney(
                              work.total_amount,
                            )
                          } €
                        </strong>

                        <span
                          className={
                            work.status === "cancelled"
                              ? "is-cancelled"
                              : "is-active"
                          }
                        >
                          {
                            work.status === "cancelled"
                              ? "Anuluar"
                              : "Aktive"
                          }
                        </span>

                      </div>

                    </div>

                  ))}

                </div>

              </article>


              <article className="simple-dashboard-card">

                <div className="simple-dashboard-card-header">

                  <div>
                    <h2>Pagesat e fundit</h2>
                    <p>Pesë pagesat më të fundit.</p>
                  </div>

                  <Link
                    to="/payments"
                    className="simple-dashboard-link"
                  >
                    Shiko të gjitha
                  </Link>

                </div>


                <div className="simple-dashboard-list">

                  {data.recent_payments.map(
                    (payment)=>(

                      <div
                        key={payment.id}
                        className="simple-dashboard-list-row"
                      >

                        <div>

                          <strong>
                            {payment.doctor_name}
                          </strong>

                          <span>
                            {
                              payment.note ??
                              "Pa shënim"
                            }
                          </span>

                        </div>


                        <div className="simple-dashboard-row-end">

                          <strong className="is-paid">
                            {
                              formatMoney(
                                payment.amount,
                              )
                            } €
                          </strong>

                          <span>
                            {
                              formatDate(
                                payment.payment_date,
                              )
                            }
                          </span>

                        </div>

                      </div>

                    ),
                  )}

                </div>

              </article>

            </section>

          </>

        )}

      </main>

    </Layout>

  );

}
