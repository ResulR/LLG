import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Layout from "@/components/Layout";
import { api } from "@/lib/api";


type Doctor = {
  id:string;
  name:string;
};


type Payment = {
  id:string;
  doctor_id:string;
  amount:string;
  payment_date:string;
  created_at:string;
  note:string|null;
  doctor_name:string;
};


type DoctorSummary = {
  doctor_id:string;
  doctor_name:string;
  total_billed:string;
  total_paid:string;
  balance:string;
};


type PaymentSummary = {
  total_billed:string;
  total_paid:string;
  balance:string;
  payment_count:number;
  doctors:DoctorSummary[];
};


type MessageType =
  "success"|"error"|"";


function formatMoney(value:string|number) {

  const amount = Number(value || 0);

  return new Intl.NumberFormat(
    "de-DE",
    {
      minimumFractionDigits:2,
      maximumFractionDigits:2,
    },
  ).format(amount);

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


export default function Payments() {

  const [doctors,setDoctors]=useState<Doctor[]>([]);
  const [payments,setPayments]=useState<Payment[]>([]);

  const [summary,setSummary]=useState<PaymentSummary>({
    total_billed:"0",
    total_paid:"0",
    balance:"0",
    payment_count:0,
    doctors:[],
  });

  const [doctorId,setDoctorId]=useState("");
  const [amount,setAmount]=useState("");
  const [note,setNote]=useState("");

  const [search,setSearch]=useState("");
  const [doctorFilter,setDoctorFilter]=useState("all");

  const [isLoading,setIsLoading]=useState(true);
  const [isSubmitting,setIsSubmitting]=useState(false);

  const [message,setMessage]=useState("");
  const [messageType,setMessageType]=
    useState<MessageType>("");


  async function loadData() {

    setIsLoading(true);


    try {

      const [
        referencesResponse,
        paymentsResponse,
        summaryResponse,
      ] = await Promise.all([
        api("/payments/references"),
        api("/payments"),
        api("/payments/summary"),
      ]);


      if(
        !referencesResponse.ok ||
        !paymentsResponse.ok ||
        !summaryResponse.ok
      ) {

        throw new Error(
          "Payment data load failed",
        );

      }


      const references =
        await referencesResponse.json();

      const paymentsData =
        await paymentsResponse.json();

      const summaryData =
        await summaryResponse.json();


      setDoctors(references.doctors ?? []);
      setPayments(paymentsData ?? []);

      setSummary({
        total_billed:
          summaryData.total_billed ?? "0",

        total_paid:
          summaryData.total_paid ?? "0",

        balance:
          summaryData.balance ?? "0",

        payment_count:
          Number(summaryData.payment_count ?? 0),

        doctors:
          summaryData.doctors ?? [],
      });


    } catch(error) {

      console.error(error);

      setMessage(
        "Të dhënat e pagesave nuk mund të ngarkoheshin.",
      );
      setMessageType("error");


    } finally {

      setIsLoading(false);

    }

  }


  useEffect(()=>{

    loadData();

  },[]);


  const selectedDoctorSummary = useMemo(
    ()=>summary.doctors.find(
      (doctor)=>
        String(doctor.doctor_id) === doctorId
    ) ?? null,
    [summary.doctors,doctorId],
  );


  const filteredPayments = useMemo(()=>{

    const normalizedSearch =
      search.trim().toLowerCase();


    return payments.filter((payment)=>{

      const matchesDoctor =
        doctorFilter === "all" ||
        String(payment.doctor_id) ===
          doctorFilter;


      const searchableText = [
        payment.doctor_name,
        payment.note ?? "",
        payment.amount,
        formatDate(payment.payment_date),
      ]
        .join(" ")
        .toLowerCase();


      const matchesSearch =
        searchableText.includes(
          normalizedSearch,
        );


      return matchesDoctor && matchesSearch;

    });

  },[
    payments,
    search,
    doctorFilter,
  ]);


  async function createPayment(
    event:React.FormEvent,
  ) {

    event.preventDefault();

    setMessage("");
    setMessageType("");


    const numericAmount =
      Number(amount);


    if(!doctorId) {

      setMessage(
        "Zgjidhni mjekun.",
      );
      setMessageType("error");
      return;

    }


    if(
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {

      setMessage(
        "Shuma duhet të jetë më e madhe se 0.",
      );
      setMessageType("error");
      return;

    }


    setIsSubmitting(true);


    try {

      const response = await api(
        "/payments",
        {
          method:"POST",
          body:JSON.stringify({
            doctor_id:Number(doctorId),
            amount:numericAmount,
            note:note.trim(),
          }),
        },
      );


      if(!response.ok) {

        let errorMessage =
          "Pagesa nuk mund të regjistrohej.";


        try {

          const errorData =
            await response.json();


          if(
            errorData?.error ===
            "invalid_doctor"
          ) {

            errorMessage =
              "Mjeku i zgjedhur nuk është valid.";

          }


          if(
            errorData?.error ===
            "invalid_amount"
          ) {

            errorMessage =
              "Shuma nuk është valide.";

          }


        } catch {
          // Mbaj mesazhin e përgjithshëm.
        }


        setMessage(errorMessage);
        setMessageType("error");
        return;

      }


      setDoctorId("");
      setAmount("");
      setNote("");

      setMessage(
        "Pagesa u regjistrua me sukses.",
      );
      setMessageType("success");

      await loadData();


    } catch(error) {

      console.error(error);

      setMessage(
        "Ndodhi një gabim gjatë komunikimit me serverin.",
      );
      setMessageType("error");


    } finally {

      setIsSubmitting(false);

    }

  }


  return (

    <Layout>

      <main className="payments-page">

        <header className="payments-page-header">

          <div>

            <span className="payments-eyebrow">
              Menaxhimi financiar
            </span>

            <h1>Pagesat</h1>

            <p>
              Regjistroni pagesat dhe ndiqni
              gjendjen financiare të laboratorit.
            </p>

          </div>

        </header>


        <section className="payments-kpi-grid">

          <article className="payments-kpi-card is-billed">

            <div className="payments-kpi-icon">
              €
            </div>

            <div>
              <span>Totali i faturuar</span>

              <strong>
                {formatMoney(
                  summary.total_billed,
                )} €
              </strong>

              <small>
                Punët aktive
              </small>
            </div>

          </article>


          <article className="payments-kpi-card is-paid">

            <div className="payments-kpi-icon">
              ✓
            </div>

            <div>
              <span>Totali i paguar</span>

              <strong>
                {formatMoney(
                  summary.total_paid,
                )} €
              </strong>

              <small>
                Pagesat e regjistruara
              </small>
            </div>

          </article>


          <article className="payments-kpi-card is-balance">

            <div className="payments-kpi-icon">
              ≈
            </div>

            <div>
              <span>Saldo e mbetur</span>

              <strong>
                {formatMoney(
                  summary.balance,
                )} €
              </strong>

              <small>
                Faturuar − Paguar
              </small>
            </div>

          </article>


          <article className="payments-kpi-card is-count">

            <div className="payments-kpi-icon">
              #
            </div>

            <div>
              <span>Numri i pagesave</span>

              <strong>
                {summary.payment_count}
              </strong>

              <small>
                Regjistrime gjithsej
              </small>
            </div>

          </article>

        </section>


        <section className="payments-main-grid">

          <article className="payments-form-card">

            <div className="payments-section-title">

              <span className="payments-section-icon">
                +
              </span>

              <div>
                <h2>Regjistro pagesë</h2>

                <p>
                  Shtoni një pagesë të re për
                  mjekun e zgjedhur.
                </p>
              </div>

            </div>


            <form
              className="payments-form"
              onSubmit={createPayment}
            >

              <label className="payments-field">

                <span>Mjeku</span>

                <select
                  value={doctorId}
                  onChange={(event)=>
                    setDoctorId(
                      event.target.value,
                    )
                  }
                  required
                >
                  <option value="">
                    Zgjidh mjekun
                  </option>

                  {doctors.map((doctor)=>(
                    <option
                      key={doctor.id}
                      value={doctor.id}
                    >
                      {doctor.name}
                    </option>
                  ))}
                </select>

              </label>


              <label className="payments-field">

                <span>Shuma</span>

                <div className="payments-amount-input">

                  <span>€</span>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(event)=>
                      setAmount(
                        event.target.value,
                      )
                    }
                    placeholder="0.00"
                    required
                  />

                </div>

              </label>


              <label className="payments-field">

                <span>Shënim</span>

                <textarea
                  value={note}
                  onChange={(event)=>
                    setNote(
                      event.target.value,
                    )
                  }
                  placeholder="P.sh. pagesë bankare, kësti i parë..."
                  rows={4}
                  maxLength={500}
                />

                <small>
                  {note.length}/500
                </small>

              </label>


              {message && (
                <div
                  className={
                    messageType === "success"
                      ? "payments-message is-success"
                      : "payments-message is-error"
                  }
                  role="alert"
                >
                  {message}
                </div>
              )}


              <button
                type="submit"
                className="payments-submit-button"
                disabled={isSubmitting}
              >
                <span>＋</span>

                {
                  isSubmitting
                    ? "Duke u regjistruar..."
                    : "Regjistro pagesën"
                }
              </button>

            </form>

          </article>


          <aside className="payments-doctor-card">

            <div className="payments-section-title">

              <span className="payments-section-icon is-summary">
                ↗
              </span>

              <div>
                <h2>Gjendja e mjekut</h2>

                <p>
                  Përmbledhje sipas mjekut të
                  zgjedhur.
                </p>
              </div>

            </div>


            {selectedDoctorSummary ? (

              <div className="payments-doctor-summary">

                <div className="payments-doctor-name">

                  <span className="payments-avatar">
                    {
                      selectedDoctorSummary
                        .doctor_name
                        .charAt(0)
                        .toUpperCase()
                    }
                  </span>

                  <div>
                    <strong>
                      {
                        selectedDoctorSummary
                          .doctor_name
                      }
                    </strong>

                    <span>
                      Gjendja aktuale
                    </span>
                  </div>

                </div>


                <div className="payments-summary-line">

                  <span>Faturuar</span>

                  <strong>
                    {formatMoney(
                      selectedDoctorSummary
                        .total_billed,
                    )} €
                  </strong>

                </div>


                <div className="payments-summary-line">

                  <span>Paguar</span>

                  <strong className="is-paid">
                    {formatMoney(
                      selectedDoctorSummary
                        .total_paid,
                    )} €
                  </strong>

                </div>


                <div className="payments-summary-line is-balance">

                  <span>Saldo</span>

                  <strong>
                    {formatMoney(
                      selectedDoctorSummary
                        .balance,
                    )} €
                  </strong>

                </div>

              </div>

            ) : (

              <div className="payments-doctor-empty">

                <span>€</span>

                <h3>Zgjidhni një mjek</h3>

                <p>
                  Përmbledhja financiare do të
                  shfaqet këtu.
                </p>

              </div>

            )}

          </aside>

        </section>


        <section className="payments-history-card">

          <div className="payments-history-header">

            <div className="payments-section-title">

              <span className="payments-section-icon is-history">
                ▣
              </span>

              <div>
                <h2>Historiku i pagesave</h2>

                <p>
                  {filteredPayments.length} nga{" "}
                  {payments.length} pagesa
                </p>
              </div>

            </div>


            <button
              type="button"
              className="payments-refresh-button"
              onClick={loadData}
              disabled={isLoading}
            >
              ↻ Rifresko
            </button>

          </div>


          <div className="payments-filters">

            <div className="payments-search">

              <span>⌕</span>

              <input
                type="search"
                value={search}
                onChange={(event)=>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Kërko mjekun, shumën ose shënimin..."
              />

            </div>


            <select
              value={doctorFilter}
              onChange={(event)=>
                setDoctorFilter(
                  event.target.value,
                )
              }
            >
              <option value="all">
                Të gjithë mjekët
              </option>

              {doctors.map((doctor)=>(
                <option
                  key={doctor.id}
                  value={doctor.id}
                >
                  {doctor.name}
                </option>
              ))}
            </select>

          </div>


          <div className="payments-table-scroll">

            <table className="payments-table">

              <thead>

                <tr>
                  <th>Data</th>
                  <th>Mjeku</th>
                  <th>Shuma</th>
                  <th>Shënimi</th>
                  <th>Statusi</th>
                </tr>

              </thead>


              <tbody>

                {filteredPayments.map(
                  (payment)=>(

                    <tr key={payment.id}>

                      <td>
                        <div className="payments-date-cell">

                          <strong>
                            {
                              formatDate(
                                payment.payment_date,
                              )
                            }
                          </strong>

                          <span>
                            Pagesa #{payment.id}
                          </span>

                        </div>
                      </td>


                      <td>

                        <div className="payments-doctor-cell">

                          <span>
                            {
                              payment.doctor_name
                                .charAt(0)
                                .toUpperCase()
                            }
                          </span>

                          <strong>
                            {payment.doctor_name}
                          </strong>

                        </div>

                      </td>


                      <td>
                        <strong className="payments-amount">
                          {formatMoney(
                            payment.amount,
                          )} €
                        </strong>
                      </td>


                      <td>
                        <span className="payments-note">
                          {payment.note ?? "Pa shënim"}
                        </span>
                      </td>


                      <td>
                        <span className="payments-status">
                          E regjistruar
                        </span>
                      </td>

                    </tr>

                  ),
                )}


                {!isLoading &&
                  filteredPayments.length === 0 && (

                    <tr>

                      <td
                        colSpan={5}
                        className="payments-empty"
                      >
                        Nuk u gjet asnjë pagesë.
                      </td>

                    </tr>

                  )}


                {isLoading && (

                  <tr>

                    <td
                      colSpan={5}
                      className="payments-empty"
                    >
                      Duke ngarkuar...
                    </td>

                  </tr>

                )}

              </tbody>

            </table>

          </div>

        </section>

      </main>

    </Layout>

  );

}
