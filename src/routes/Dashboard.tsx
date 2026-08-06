import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowRight,
  Banknote,
  BriefcaseBusiness,
  CircleDollarSign,
  RefreshCw,
} from "lucide-react";

import {
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


type ActivityItem = {
  id:string;
  type:"payment"|"work";
  title:string;
  subtitle:string;
  date:string;
};


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


function formatCompactMoney(
  value:string|number,
) {

  return new Intl.NumberFormat(
    "de-DE",
    {
      minimumFractionDigits:0,
      maximumFractionDigits:2,
    },
  ).format(
    Number(value || 0),
  );

}


function formatDate(value:string) {

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
  work:RecentWork,
) {

  return [
    work.year,
    String(work.month).padStart(2,"0"),
    String(work.monthly_number)
      .padStart(3,"0"),
  ].join("-");

}


function getDoctorInitials(
  name:string,
) {

  const parts =
    name
      .trim()
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

}


function getDebtStatus(
  days:number,
) {

  if(days > 30) {

    return {
      label:"Urgjente",
      className:"is-urgent",
    };

  }


  if(days > 14) {

    return {
      label:"Për ndjekje",
      className:"is-follow-up",
    };

  }


  return {
    label:"E re",
    className:"is-new",
  };

}


export default function Dashboard() {

  const navigate =
    useNavigate();

  const {
    selectedMonth,
  } =
    useMonth();

  const [
    data,
    setData,
  ] =
    useState<DashboardData|null>(
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


      setData(
        await response.json(),
      );


    } catch(error) {

      console.error(error);

      setError(
        "Të dhënat nuk mund të ngarkoheshin.",
      );


    } finally {

      setIsLoading(false);

    }

  }


  useEffect(
    ()=>{

      void loadDashboard();

    },
    [
      selectedMonth,
    ],
  );


  const priorityReceivables =
    useMemo(
      ()=>{

        if(!data) {
          return [];
        }


        return [...data.receivables]
          .filter(
            (receivable)=>
              Number(
                receivable
                  .outstanding_balance,
              ) > 0,
          )
          .sort(
            (first,second)=>{

              const firstScore =
                Number(
                  first.outstanding_balance,
                ) *
                Math.max(
                  first.days_outstanding,
                  1,
                );

              const secondScore =
                Number(
                  second.outstanding_balance,
                ) *
                Math.max(
                  second.days_outstanding,
                  1,
                );


              return secondScore - firstScore;

            },
          )
          .slice(0,4);

      },
      [
        data,
      ],
    );


  const maximumPriorityScore =
    useMemo(
      ()=>{

        return Math.max(
          ...priorityReceivables.map(
            (receivable)=>
              Number(
                receivable
                  .outstanding_balance,
              ) *
              Math.max(
                receivable.days_outstanding,
                1,
              ),
          ),
          1,
        );

      },
      [
        priorityReceivables,
      ],
    );


  const recentActivity =
    useMemo<ActivityItem[]>(
      ()=>{

        if(!data) {
          return [];
        }


        const workItems =
          data.recent_works.map(
            (work)=>({
              id:`work-${work.id}`,
              type:"work" as const,
              title:
                `Punë e re ${getWorkNumber(
                  work,
                )}`,
              subtitle:
                `${work.first_name} ${work.last_name}`,
              date:work.work_date,
            }),
          );


        const paymentItems =
          data.recent_payments.map(
            (payment)=>({
              id:`payment-${payment.id}`,
              type:"payment" as const,
              title:
                `Pagesë ${formatCompactMoney(
                  payment.amount,
                )} €`,
              subtitle:
                payment.doctor_name,
              date:payment.payment_date,
            }),
          );


        return [
          ...workItems,
          ...paymentItems,
        ]
          .sort(
            (first,second)=>
              second.date.localeCompare(
                first.date,
              ),
          )
          .slice(0,3);

      },
      [
        data,
      ],
    );


  const financialDistribution =
    useMemo(
      ()=>{

        if(!data) {

          return {
            paid:0,
            debt:0,
          };

        }


        const paid =
          Math.max(
            Number(
              data.overview.total_paid,
            ),
            0,
          );

        const debt =
          Math.max(
            Number(
              data.overview
                .outstanding_balance,
            ),
            0,
          );

        const total =
          paid + debt;


        if(total <= 0) {

          return {
            paid:0,
            debt:0,
          };

        }


        return {
          paid:
            (
              paid /
              total
            ) * 100,

          debt:
            (
              debt /
              total
            ) * 100,
        };

      },
      [
        data,
      ],
    );


  return (

    <Layout>

      <main className="finance-dashboard">

        {error && (

          <section
            className="finance-dashboard-error"
            role="alert"
          >
            <div>
              <strong>
                Të dhënat nuk u ngarkuan
              </strong>

              <span>{error}</span>
            </div>

            <button
              type="button"
              onClick={()=>
                void loadDashboard()
              }
            >
              <RefreshCw
                size={15}
                aria-hidden="true"
              />

              Provo përsëri
            </button>
          </section>

        )}


        {isLoading && !data && (

          <section
            className="finance-dashboard-loading"
            aria-live="polite"
          >
            Duke ngarkuar të dhënat...
          </section>

        )}


        {data && (

          <>

            <section className="finance-band">

              <div className="finance-band-primary">

                <span>Faturuar këtë muaj</span>

                <strong>
                  {
                    formatMoney(
                      data.overview.total_billed,
                    )
                  } €
                </strong>

              </div>


              <div
                className="finance-band-progress"
                aria-label={
                  `Krahasim vizual: ${formatCompactMoney(
                    data.overview.total_paid,
                  )} euro të paguara këtë muaj dhe ${formatCompactMoney(
                    data.overview.outstanding_balance,
                  )} euro borxh aktual`
                }
              >

                <span
                  className="is-paid"
                  style={{
                    width:
                      `${financialDistribution.paid}%`,
                  }}
                />

                <span
                  className="is-debt"
                  style={{
                    width:
                      `${financialDistribution.debt}%`,
                  }}
                />

              </div>


              <div className="finance-band-stat is-paid">

                <span>Paguar</span>

                <strong>
                  {
                    formatMoney(
                      data.overview.total_paid,
                    )
                  } €
                </strong>

              </div>


              <div className="finance-band-stat is-debt">

                <span>Borxh gjithsej</span>

                <strong>
                  {
                    formatMoney(
                      data.overview
                        .outstanding_balance,
                    )
                  } €
                </strong>

              </div>


              <div className="finance-band-stat is-works">

                <span>Punë aktive</span>

                <strong>
                  {data.overview.active_works}
                </strong>

                <small>
                  / {data.overview.active_doctors} mjekë
                </small>

              </div>

            </section>


            <section className="finance-dashboard-grid">

              <article className="priority-debts-card">

                <header className="finance-card-header">

                  <div>
                    <h1>Borxhi me përparësi</h1>

                    <p>
                      Renditur sipas shumës dhe
                      moshës së borxhit.
                    </p>
                  </div>


                  <button
                    type="button"
                    onClick={()=>
                      navigate(
                        "/payments",
                      )
                    }
                  >
                    Shiko të gjitha
                    <ArrowRight
                      size={14}
                      aria-hidden="true"
                    />
                  </button>

                </header>


                <div className="priority-debts-list">

                  {priorityReceivables.map(
                    (receivable)=>{

                      const status =
                        getDebtStatus(
                          receivable
                            .days_outstanding,
                        );

                      const score =
                        Number(
                          receivable
                            .outstanding_balance,
                        ) *
                        Math.max(
                          receivable
                            .days_outstanding,
                          1,
                        );

                      const priorityWidth =
                        Math.max(
                          (
                            score /
                            maximumPriorityScore
                          ) * 100,
                          12,
                        );


                      return (

                        <button
                          key={
                            receivable.doctor_id
                          }
                          type="button"
                          className={
                            `priority-debt-row ${status.className}`
                          }
                          onClick={()=>
                            navigate(
                              `/doctors/${receivable.doctor_id}`,
                            )
                          }
                        >

                          <span className="priority-debt-avatar">
                            {
                              getDoctorInitials(
                                receivable
                                  .doctor_name,
                              )
                            }
                          </span>


                          <span className="priority-debt-identity">

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
                              {" · "}
                              {
                                receivable
                                  .days_outstanding
                              } ditë pa pagesë
                            </small>

                          </span>


                          <span className="priority-debt-meter">

                            <i
                              style={{
                                width:
                                  `${priorityWidth}%`,
                              }}
                            />

                          </span>


                          <strong className="priority-debt-amount">
                            {
                              formatCompactMoney(
                                receivable
                                  .outstanding_balance,
                              )
                            } €
                          </strong>


                          <span className="priority-debt-status">
                            {status.label}
                          </span>

                        </button>

                      );

                    },
                  )}


                  {priorityReceivables.length === 0 && (

                    <div className="priority-debts-empty">

                      <CircleDollarSign
                        size={28}
                        aria-hidden="true"
                      />

                      <strong>
                        Nuk ka borxhe të hapura
                      </strong>

                      <span>
                        Të gjitha pagesat janë
                        të rregulluara.
                      </span>

                    </div>

                  )}

                </div>

              </article>


              <aside className="finance-dashboard-aside">

                <article className="recent-activity-card">

                  <header className="finance-card-header">

                    <div>
                      <h2>Aktiviteti i fundit</h2>
                    </div>

                  </header>


                  <div className="recent-activity-list">

                    {recentActivity.map(
                      (activity)=>(

                        <div
                          key={activity.id}
                          className={
                            `recent-activity-row is-${activity.type}`
                          }
                        >

                          <span
                            className="recent-activity-dot"
                            aria-hidden="true"
                          />

                          <div>

                            <strong>
                              {activity.title}
                              {" — "}
                              {activity.subtitle}
                            </strong>

                            <small>
                              {
                                formatDate(
                                  activity.date,
                                )
                              }
                            </small>

                          </div>

                        </div>

                      ),
                    )}


                    {recentActivity.length === 0 && (

                      <p className="recent-activity-empty">
                        Nuk ka aktivitet për këtë muaj.
                      </p>

                    )}

                  </div>

                </article>


                <article className="global-payment-card">

                  <Banknote
                    size={22}
                    aria-hidden="true"
                  />

                  <h2>
                    Mbyll shumë punë menjëherë
                  </h2>

                  <p>
                    {
                      data.receivables.length
                    } mjekë kanë detyrime që mund
                    të menaxhohen nga pagesa globale.
                  </p>

                  <button
                    type="button"
                    onClick={()=>
                      navigate(
                        "/payments",
                      )
                    }
                  >
                    Shko te pagesa globale

                    <ArrowRight
                      size={15}
                      aria-hidden="true"
                    />
                  </button>

                </article>

              </aside>

            </section>


            <footer className="finance-dashboard-footer">

              <span>
                <BriefcaseBusiness
                  size={14}
                  aria-hidden="true"
                />

                {
                  data.overview.active_works
                } punë aktive
              </span>

              <span>
                <CircleDollarSign
                  size={14}
                  aria-hidden="true"
                />

                {
                  data.receivables.length
                } mjekë me borxh
              </span>

              <button
                type="button"
                onClick={()=>
                  void loadDashboard()
                }
                disabled={isLoading}
              >
                <RefreshCw
                  size={14}
                  aria-hidden="true"
                />

                Rifresko
              </button>

            </footer>

          </>

        )}

      </main>

    </Layout>

  );

}
