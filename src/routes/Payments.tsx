import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Layout from "@/components/Layout";
import AppToast from "@/components/AppToast";
import { useMonth } from "@/context/MonthContext";
import { api } from "@/lib/api";

import { useConfirm } from "@/context/ConfirmContext";
import { useUnsavedChanges } from "@/lib/useUnsavedChanges";


type Doctor = {
  id:string;
  name:string;
};


type Tooth = {
  number:number;
  is_antar:boolean;
};


type Work = {
  id:string;
  doctor_id:string;
  patient_id:string;
  year:number;
  month:number;
  monthly_number:number;
  work_date:string;
  description:string|null;
  is_repeat:boolean;
  pricing_mode:"per_tooth"|"fixed_total";
  price_per_tooth:string;
  original_total_amount:string;
  discount_total:string;
  total_amount:string;
  payment_status:
    "unpaid"|"partial"|"paid"|"closed_global";
  doctor_name:string;
  first_name:string;
  last_name:string;
  material_name:string|null;
  color_name:string|null;
  paid_amount:string;
  remaining_amount:string;
  teeth:Tooth[];
};


type GlobalBalance = {
  doctor_id:string;
  doctor_name:string;
  settled_total:string;
  covered_total:string;
  global_balance:string;
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


type MessageType =
  "success"|"error"|"";


type PaymentView =
  "individual" |
  "global" |
  "history";


const upperLeft = [18,17,16,15,14,13,12,11];
const upperRight = [21,22,23,24,25,26,27,28];
const lowerLeft = [48,47,46,45,44,43,42,41];
const lowerRight = [31,32,33,34,35,36,37,38];


function formatMoney(
  value:string|number,
) {

  return new Intl.NumberFormat(
    "fr-FR",
    {
      minimumFractionDigits:2,
      maximumFractionDigits:2,
    },
  ).format(
    Number(value || 0),
  );

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


function getToday() {

  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1,
    ).padStart(2,"0");

  const day =
    String(
      now.getDate(),
    ).padStart(2,"0");

  return `${year}-${month}-${day}`;

}


function getWorkNumber(work:Work) {

  return [
    work.year,
    String(work.month).padStart(2,"0"),
    String(work.monthly_number)
      .padStart(3,"0"),
  ].join("-");

}


function getPaymentStatusLabel(
  status:Work["payment_status"],
) {

  if(status === "partial") {
    return "Pjesërisht";
  }

  if(status === "paid") {
    return "Paguar";
  }

  if(status === "closed_global") {
    return "Mbyllur në grup";
  }

  return "Pa paguar";

}


function getPaymentError(
  error:string|undefined,
) {

  if(error === "invalid_amount") {
    return "Shuma e pagesës nuk është valide.";
  }

  if(error === "invalid_final_amount") {
    return "Shuma finale e faturuar nuk është valide.";
  }

  if(error === "final_amount_exceeds_debt") {
    return "Shuma finale nuk mund të jetë më e madhe se borxhi aktual.";
  }

  if(error === "amount_exceeds_final_amount") {
    return "Pagesa nuk mund të jetë më e madhe se shuma finale e faturuar.";
  }

  if(error === "final_amount_below_paid") {
    return "Çmimi final nuk mund të jetë më i vogël se shuma e paguar tashmë.";
  }

  if(error === "empty_payment_operation") {
    return "Shkruani një pagesë ose një zbritje.";
  }

  if(error === "amount_exceeds_remaining") {
    return "Pagesa dhe zbritja e tejkalojnë shumën e mbetur.";
  }

  if(error === "amount_exceeds_settlement") {
    return "Pagesa dhe zbritja e tejkalojnë borxhin e zgjedhur.";
  }

  if(error === "amount_exceeds_global_balance") {
    return "Pagesa dhe zbritja e tejkalojnë borxhin global.";
  }

  if(error === "work_not_payable") {
    return "Kjo punë nuk mund të paguhet më.";
  }

  if(error === "works_not_payable") {
    return "Një ose më shumë punë të zgjedhura nuk mund të mbyllen.";
  }

  if(error === "no_global_balance") {
    return "Ky mjek nuk ka borxh global për të paguar.";
  }

  return "Veprimi nuk mund të regjistrohej.";
}


function ToothMap({
  teeth,
}:{
  teeth:Tooth[];
}) {

  const selected =
    new Map(
      teeth.map(
        (tooth)=>[
          tooth.number,
          tooth,
        ],
      ),
    );


  function renderQuadrant(
    title:string,
    numbers:number[],
  ) {

    return (
      <div className="payment-tooth-quadrant">

        <span>{title}</span>

        <div>

          {numbers.map((number)=>{

            const tooth =
              selected.get(number);

            return (
              <span
                key={number}
                className={
                  tooth
                    ? tooth.is_antar
                      ? "is-antar"
                      : "is-selected"
                    : ""
                }
              >
                {number}
              </span>
            );

          })}

        </div>

      </div>
    );

  }


  return (
    <div className="payment-tooth-map">

      {renderQuadrant(
        "Sipër majtas",
        upperLeft,
      )}

      {renderQuadrant(
        "Sipër djathtas",
        upperRight,
      )}

      {renderQuadrant(
        "Poshtë majtas",
        lowerLeft,
      )}

      {renderQuadrant(
        "Poshtë djathtas",
        lowerRight,
      )}

    </div>
  );

}


export default function Payments() {

  const {
    confirmAction,
  } = useConfirm();

  const {
    selectedMonth,
  } = useMonth();

  const [doctors,setDoctors]=
    useState<Doctor[]>([]);

  const [works,setWorks]=
    useState<Work[]>([]);

  const [globalWorks,setGlobalWorks]=
    useState<Work[]>([]);

  const [
    isGlobalWorksExpanded,
    setIsGlobalWorksExpanded,
  ] =
    useState(false);

  const [
    globalBalances,
    setGlobalBalances,
  ] = useState<GlobalBalance[]>([]);

  const [payments,setPayments]=
    useState<Payment[]>([]);

  const [doctorFilter,setDoctorFilter]=
    useState("all");

  const [sortDirection,setSortDirection]=
    useState<"asc"|"desc">("asc");

  const [search,setSearch]=
    useState("");

  const [selectedWork,setSelectedWork]=
    useState<Work|null>(null);

  const [workAmount,setWorkAmount]=
    useState("");

  const [
    workHasFinalPriceChange,
    setWorkHasFinalPriceChange,
  ] = useState(false);

  const [workFinalAmount,setWorkFinalAmount]=
    useState("");

  const [workPaymentDate,setWorkPaymentDate]=
    useState(getToday());

  const [workNote,setWorkNote]=
    useState("");

  const [globalDoctorId,setGlobalDoctorId]=
    useState("");

  const [
    selectedGlobalWorkIds,
    setSelectedGlobalWorkIds,
  ] = useState<string[]>([]);

  const [globalAmount,setGlobalAmount]=
    useState("");

  const [
    globalHasDiscount,
    setGlobalHasDiscount,
  ] = useState(false);

  const [
    globalDiscount,
    setGlobalDiscount,
  ] = useState("");

  const [
    globalPaymentDate,
    setGlobalPaymentDate,
  ] = useState(getToday());

  const [globalNote,setGlobalNote]=
    useState("");

  const [isLoading,setIsLoading]=
    useState(true);

  const [isSubmitting,setIsSubmitting]=
    useState(false);

  const [message,setMessage]=
    useState("");

  const [messageType,setMessageType]=
    useState<MessageType>("");

  const [
    activeView,
    setActiveView,
  ] =
    useState<PaymentView>(
      "individual",
    );


  const workPaymentIsDirty =
    Boolean(
      selectedWork &&
      (
        workAmount ||
        workHasFinalPriceChange ||
        workFinalAmount ||
        workNote.trim() ||
        workPaymentDate !== getToday()
      )
    );


  const globalSettlementIsDirty =
    Boolean(
      globalDoctorId ||
      selectedGlobalWorkIds.length > 0 ||
      globalAmount ||
      globalHasDiscount ||
      globalDiscount ||
      globalNote.trim() ||
      globalPaymentDate !== getToday()
    );


  useUnsavedChanges(
    "individual-work-payment",
    workPaymentIsDirty,
  );

  useUnsavedChanges(
    "global-settlement-payment",
    globalSettlementIsDirty,
  );

  async function loadData() {

    setIsLoading(true);


    try {

      const query =
        new URLSearchParams();

      if(doctorFilter !== "all") {
        query.set(
          "doctor_id",
          doctorFilter,
        );
      }

      query.set(
        "sort",
        sortDirection,
      );


      const [
        referencesResponse,
        worksResponse,
        globalWorksResponse,
        balancesResponse,
        paymentsResponse,
      ] = await Promise.all([
        api("/payments/references"),

        api(
          `/payments/unpaid-works?${query.toString()}`,
        ),

        api(
          "/payments/unpaid-works?sort=asc",
        ),

        api("/payments/global-balances"),

        api(
          `/payments?month=${encodeURIComponent(
            selectedMonth,
          )}`,
        ),
      ]);


      if(
        !referencesResponse.ok ||
        !worksResponse.ok ||
        !globalWorksResponse.ok ||
        !balancesResponse.ok ||
        !paymentsResponse.ok
      ) {

        throw new Error(
          "Payment data load failed",
        );

      }


      const references =
        await referencesResponse.json();

      const worksData =
        await worksResponse.json();

      const globalWorksData =
        await globalWorksResponse.json();

      const balancesData =
        await balancesResponse.json();

      const paymentsData =
        await paymentsResponse.json();


      setDoctors(
        references.doctors ?? [],
      );

      setWorks(
        worksData ?? [],
      );

      setGlobalWorks(
        globalWorksData ?? [],
      );

      setGlobalBalances(
        balancesData ?? [],
      );

      setPayments(
        paymentsData ?? [],
      );


      setSelectedWork(
        (currentSelectedWork)=>{

          if(!currentSelectedWork) {
            return null;
          }


          const refreshedWork =
            (worksData ?? []).find(
              (work:Work)=>
                String(work.id) ===
                String(
                  currentSelectedWork.id,
                ),
            );


          return refreshedWork ?? null;

        },
      );


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

  },[
    doctorFilter,
    selectedMonth,
    sortDirection,
  ]);


  const filteredWorks =
    useMemo(
      ()=>{

        const normalizedSearch =
          search
            .trim()
            .toLowerCase();


        return works.filter(
          (work)=>{

            const searchableText = [
              getWorkNumber(work),
              work.doctor_name,
              work.first_name,
              work.last_name,
              work.material_name ?? "",
              work.color_name ?? "",
              work.description ?? "",
            ]
              .join(" ")
              .toLowerCase();


            return searchableText.includes(
              normalizedSearch,
            );

          },
        );

      },
      [
        works,
        search,
      ],
    );


  const selectedGlobalDoctorWorks =
    useMemo(
      ()=>globalWorks.filter(
        (work)=>
          String(work.doctor_id) ===
          globalDoctorId,
      ),
      [
        globalWorks,
        globalDoctorId,
      ],
    );


  useEffect(()=>{

    if(!globalDoctorId) {

      setSelectedGlobalWorkIds([]);
      return;

    }


    setSelectedGlobalWorkIds(
      globalWorks
        .filter(
          (work)=>
            String(work.doctor_id) ===
            globalDoctorId,
        )
        .map(
          (work)=>
            String(work.id),
        ),
    );

  },[
    globalDoctorId,
    globalWorks,
  ]);


  const selectedGlobalWorks =
    useMemo(
      ()=>selectedGlobalDoctorWorks.filter(
        (work)=>
          selectedGlobalWorkIds.includes(
            String(work.id),
          ),
      ),
      [
        selectedGlobalDoctorWorks,
        selectedGlobalWorkIds,
      ],
    );


  const selectedWorksTotal =
    useMemo(
      ()=>selectedGlobalWorks.reduce(
        (sum,work)=>
          sum
          + Number(
              work.remaining_amount || 0,
            ),
        0,
      ),
      [selectedGlobalWorks],
    );


  const selectedGlobalBalance =
    useMemo(
      ()=>globalBalances.find(
        (balance)=>
          String(balance.doctor_id) ===
          globalDoctorId,
      ) ?? null,
      [
        globalBalances,
        globalDoctorId,
      ],
    );


  const totalIndividualDebt =
    useMemo(
      ()=>works.reduce(
        (sum,work)=>
          sum
          + Number(
              work.remaining_amount || 0,
            ),
        0,
      ),
      [works],
    );


  const totalGlobalDebt =
    useMemo(
      ()=>globalBalances.reduce(
        (sum,balance)=>
          sum
          + Number(
              balance.global_balance || 0,
            ),
        0,
      ),
      [globalBalances],
    );


  function openWork(work:Work) {

    setSelectedWork(work);
    setWorkAmount("");
    setWorkHasFinalPriceChange(false);
    setWorkFinalAmount("");
    setWorkPaymentDate(getToday());
    setWorkNote("");
    setMessage("");
    setMessageType("");

  }


  function closeWork() {

    if(workPaymentIsDirty) {
      setMessage(
        "Ruajeni ose pastroni pagesën para se ta mbyllni punën.",
      );
      setMessageType("error");
      return;
    }

    setSelectedWork(null);

  }


  function toggleGlobalWork(
    workId:string,
  ) {

    setSelectedGlobalWorkIds(
      (current)=>
        current.includes(workId)
          ? current.filter(
              (id)=>id !== workId,
            )
          : [
              ...current,
              workId,
            ],
    );

  }


  function selectAllGlobalWorks() {

    const allIds =
      selectedGlobalDoctorWorks.map(
        (work)=>String(work.id),
      );

    const allSelected =
      allIds.length > 0 &&
      allIds.every(
        (id)=>
          selectedGlobalWorkIds.includes(id),
      );


    setSelectedGlobalWorkIds(
      allSelected
        ? []
        : allIds,
    );

  }


  async function submitWorkPayment(
    event:React.FormEvent,
  ) {

    event.preventDefault();

    if(!selectedWork) {
      return;
    }


    const amount =
      Number(workAmount || 0);

    const finalAmount =
      workHasFinalPriceChange
        ? Number(workFinalAmount)
        : Number(selectedWork.total_amount);

    const paidBefore =
      Number(selectedWork.paid_amount);

    const remainingAfterPriceChange =
      Math.max(
        finalAmount - paidBefore,
        0,
      );


    if(
      !Number.isFinite(amount) ||
      amount < 0
    ) {

      setMessage(
        "Shuma e pagesës nuk është valide.",
      );
      setMessageType("error");
      return;

    }


    if(
      workHasFinalPriceChange &&
      (
        !Number.isFinite(finalAmount) ||
        finalAmount < 0
      )
    ) {

      setMessage(
        "Çmimi final i faturuar nuk është valid.",
      );
      setMessageType("error");
      return;

    }


    if(
      workHasFinalPriceChange &&
      finalAmount < paidBefore
    ) {

      setMessage(
        `Çmimi final nuk mund të jetë më i vogël se ${formatMoney(paidBefore)} €, sepse kjo shumë është paguar tashmë.`,
      );
      setMessageType("error");
      return;

    }


    if(
      amount <= 0 &&
      !workHasFinalPriceChange
    ) {

      setMessage(
        "Shkruani një pagesë ose ndryshoni çmimin final.",
      );
      setMessageType("error");
      return;

    }


    if(
      amount >
      remainingAfterPriceChange
    ) {

      setMessage(
        `Pagesa nuk mund të jetë më e madhe se shuma e mbetur prej ${formatMoney(remainingAfterPriceChange)} €.`,
      );
      setMessageType("error");
      return;

    }


    const confirmed =
      await confirmAction({
        title:"Regjistro pagesën",

        message:
          `Të regjistrohet pagesa për punën ${getWorkNumber(selectedWork)}?`,

        confirmLabel:"Regjistro",
        tone:"primary",
      });


    if(!confirmed) {
      return;
    }


    setIsSubmitting(true);
    setMessage("");
    setMessageType("");


    try {

      const response =
        await api(
          `/payments/work/${selectedWork.id}`,
          {
            method:"POST",

            body:JSON.stringify({
              amount,

              final_amount:
                workHasFinalPriceChange
                  ? finalAmount
                  : undefined,

              payment_date:workPaymentDate,
              note:workNote.trim(),
            }),
          },
        );


      const data =
        await response.json()
          .catch(()=>({}));


      if(!response.ok) {

        if(
          data?.error ===
          "final_amount_below_paid"
        ) {

          setMessage(
            `Çmimi final nuk mund të jetë më i vogël se ${formatMoney(data.minimum_final_amount ?? data.paid_amount ?? 0)} €, sepse kjo shumë është paguar tashmë.`,
          );

        } else {

          setMessage(
            getPaymentError(
              data?.error,
            ),
          );

        }

        setMessageType("error");
        return;

      }


      setSelectedWork(null);
      setWorkAmount("");
      setWorkHasFinalPriceChange(false);
      setWorkFinalAmount("");
      setWorkPaymentDate(getToday());
      setWorkNote("");

      setMessage(
        data.payment_status === "paid"
          ? "Puna u pagua plotësisht."
          : "Pagesa e pjesshme u regjistrua.",
      );

      setMessageType("success");

      await loadData();


    } catch(error) {

      console.error(error);

      setMessage(
        "Ndodhi një gabim gjatë regjistrimit të pagesës.",
      );

      setMessageType("error");


    } finally {

      setIsSubmitting(false);

    }

  }


  async function submitGlobalSettlement(
    event:React.FormEvent,
  ) {

    event.preventDefault();


    const amount =
      Number(globalAmount || 0);

    const previousDebt =
      Number(
        selectedGlobalBalance
          ?.global_balance ?? 0,
      );

    const hasSelectedWorks =
      selectedGlobalWorkIds.length > 0;

    const totalDebt =
      previousDebt
      + selectedWorksTotal;

    const finalAmount =
      globalHasDiscount
        ? Number(globalDiscount)
        : totalDebt;


    if(!globalDoctorId) {

      setMessage(
        "Zgjidhni mjekun.",
      );
      setMessageType("error");
      return;

    }


    if(
      !hasSelectedWorks &&
      previousDebt <= 0
    ) {

      setMessage(
        "Ky mjek nuk ka punë të hapura ose borxh global për të paguar.",
      );
      setMessageType("error");
      return;

    }


    if(
      !Number.isFinite(amount) ||
      amount < 0
    ) {

      setMessage(
        "Shuma e pagesës nuk është valide.",
      );
      setMessageType("error");
      return;

    }


    if(
      !Number.isFinite(finalAmount) ||
      finalAmount < 0
    ) {

      setMessage(
        "Shuma finale e faturuar nuk është valide.",
      );
      setMessageType("error");
      return;

    }


    if(amount <= 0) {

      setMessage(
        "Shuma e paguar duhet të jetë më e madhe se 0 €.",
      );
      setMessageType("error");
      return;

    }


    if(amount > finalAmount) {

      setMessage(
        `Pagesa nuk mund të jetë më e madhe se shuma finale prej ${formatMoney(finalAmount)} €.`,
      );
      setMessageType("error");
      return;

    }


    const confirmationMessage =
      hasSelectedWorks
        ? `Të mbyllen ${selectedGlobalWorkIds.length} punë dhe të regjistrohet pagesa globale?`
        : "Të regjistrohet pagesa për borxhin global të mjekut?";


    const confirmed =
      await confirmAction({
        title:
          hasSelectedWorks
            ? "Mbyll punët"
            : "Regjistro pagesën globale",

        message:
          confirmationMessage,

        confirmLabel:
          hasSelectedWorks
            ? "Mbyll dhe regjistro"
            : "Regjistro",

        tone:"primary",
      });


    if(!confirmed) {
      return;
    }


    setIsSubmitting(true);
    setMessage("");
    setMessageType("");


    try {

      const endpoint =
        hasSelectedWorks
          ? "/payments/global-settlements"
          : "/payments/global-payments";


      const requestBody =
        hasSelectedWorks
          ? {
              doctor_id:Number(
                globalDoctorId,
              ),

              work_ids:
                selectedGlobalWorkIds.map(
                  Number,
                ),

              amount,

              final_amount:
                finalAmount,

              payment_date:
                globalPaymentDate,

              note:
                globalNote.trim(),
            }
          : {
              doctor_id:Number(
                globalDoctorId,
              ),

              amount,

              final_amount:
                finalAmount,

              payment_date:
                globalPaymentDate,

              note:
                globalNote.trim(),
            };


      const response =
        await api(
          endpoint,
          {
            method:"POST",

            body:JSON.stringify(
              requestBody,
            ),
          },
        );


      const data =
        await response.json()
          .catch(()=>({}));


      if(!response.ok) {

        setMessage(
          getPaymentError(
            data?.error,
          ),
        );

        setMessageType("error");
        return;

      }


      setGlobalDoctorId("");
      setSelectedGlobalWorkIds([]);
      setGlobalAmount("");
      setGlobalHasDiscount(false);
      setGlobalDiscount("");
      setGlobalPaymentDate(getToday());
      setGlobalNote("");

      setMessage(
        `Pagesa globale u regjistrua. Borxhi i mbetur: ${formatMoney(data.remaining_global_balance)} €`,
      );

      setMessageType("success");

      await loadData();


    } catch(error) {

      console.error(error);

      setMessage(
        "Pagesa globale nuk mund të regjistrohej.",
      );

      setMessageType("error");


    } finally {

      setIsSubmitting(false);

    }

  }


  return (
    <Layout>

      <main className="payments-page payments-v2">

        <header className="payments-page-header">

          <div>

            <span className="payments-eyebrow">
              Menaxhimi financiar
            </span>

            <h1>Pagesat</h1>

            <p>
              Regjistroni pagesat sipas punës
              ose mbyllni disa punë me një
              pagesë globale.
            </p>

          </div>

          <button
            type="button"
            className="payments-refresh-button"
            onClick={loadData}
            disabled={isLoading}
          >
            ↻ Rifresko
          </button>

        </header>


        {message && (

          <AppToast
            message={message}
            type={
              messageType === "success"
                ? "success"
                : "error"
            }
            onClose={()=>{

              setMessage("");
              setMessageType("");

            }}
          />

        )}


        <section className="payments-kpi-grid">

          <article className="payments-kpi-card is-balance">
            <div className="payments-kpi-icon">
              ≈
            </div>

            <div>
              <span>Borxhi i punëve</span>

              <strong>
                {formatMoney(
                  totalIndividualDebt,
                )} €
              </strong>

              <small>
                Punë ende të pambyllura
              </small>
            </div>
          </article>


          <article className="payments-kpi-card is-billed">
            <div className="payments-kpi-icon">
              ▣
            </div>

            <div>
              <span>Punë për pagesë</span>

              <strong>
                {works.length}
              </strong>

              <small>
                Të papaguara ose të pjesshme
              </small>
            </div>
          </article>


          <article className="payments-kpi-card is-count">
            <div className="payments-kpi-icon">
              ↗
            </div>

            <div>
              <span>Borxhi global</span>

              <strong>
                {formatMoney(
                  totalGlobalDebt,
                )} €
              </strong>

              <small>
                Nga punët e mbyllura në grup
              </small>
            </div>
          </article>


          <article className="payments-kpi-card is-paid">
            <div className="payments-kpi-icon">
              €
            </div>

            <div>
              <span>Pagesa të regjistruara</span>

              <strong>
                {payments.length}
              </strong>

              <small>
                Historiku aktual
              </small>
            </div>
          </article>

        </section>


        <nav
          className="payments-view-tabs"
          role="tablist"
          aria-label="Seksionet e pagesave"
        >

          <button
            id="payments-tab-individual"
            type="button"
            role="tab"
            aria-selected={
              activeView === "individual"
            }
            aria-controls="payments-panel-individual"
            className={
              activeView === "individual"
                ? "is-active"
                : ""
            }
            onClick={()=>
              setActiveView(
                "individual",
              )
            }
          >
            <span>1</span>

            <div>
              <strong>Sipas punës</strong>
              <small>Pagesë individuale</small>
            </div>
          </button>


          <button
            id="payments-tab-global"
            type="button"
            role="tab"
            aria-selected={
              activeView === "global"
            }
            aria-controls="payments-panel-global"
            className={
              activeView === "global"
                ? "is-active"
                : ""
            }
            onClick={()=>
              setActiveView(
                "global",
              )
            }
          >
            <span>2</span>

            <div>
              <strong>Pagesë globale</strong>
              <small>Disa punë së bashku</small>
            </div>
          </button>


          <button
            id="payments-tab-history"
            type="button"
            role="tab"
            aria-selected={
              activeView === "history"
            }
            aria-controls="payments-panel-history"
            className={
              activeView === "history"
                ? "is-active"
                : ""
            }
            onClick={()=>
              setActiveView(
                "history",
              )
            }
          >
            <span>3</span>

            <div>
              <strong>Historiku</strong>
              <small>Pagesat e regjistruara</small>
            </div>
          </button>

        </nav>


        <section
          id="payments-panel-individual"
          className="payment-work-section"
          role="tabpanel"
          aria-labelledby="payments-tab-individual"
          hidden={
            activeView !== "individual"
          }
        >

          <div className="payments-history-header">

            <div className="payments-section-title">

              <span className="payments-section-icon">
                1
              </span>

              <div>
                <h2>Pagesa sipas punës</h2>

                <p>
                  Zgjidhni një punë për të
                  regjistruar një pagesë të
                  plotë ose të pjesshme.
                </p>
              </div>

            </div>

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
                placeholder="Kërko punën, pacientin ose mjekun..."
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


            <select
              value={sortDirection}
              onChange={(event)=>
                setSortDirection(
                  event.target.value as
                    "asc"|"desc",
                )
              }
            >
              <option value="asc">
                Më të vjetrat së pari
              </option>

              <option value="desc">
                Më të rejat së pari
              </option>
            </select>

          </div>


          <div className="payments-table-scroll payment-work-table-scroll">

            <table className="payments-table payment-work-table">

              <thead>
                <tr>
                  <th>Nr.</th>
                  <th>Data</th>
                  <th>Mjeku</th>
                  <th>Pacienti</th>
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
                    className="payment-work-row"
                    tabIndex={0}
                    role="button"
                    aria-label={
                      `Hap punën ${getWorkNumber(work)}`
                    }
                    onClick={()=>
                      openWork(work)
                    }
                    onKeyDown={(event)=>{

                      if(
                        event.key === "Enter" ||
                        event.key === " "
                      ) {

                        event.preventDefault();
                        openWork(work);

                      }

                    }}
                  >

                    <td>
                      <strong>
                        {getWorkNumber(work)}
                      </strong>
                    </td>

                    <td>
                      {formatDate(
                        work.work_date,
                      )}
                    </td>

                    <td>
                      {work.doctor_name}
                    </td>

                    <td>
                      {work.first_name}{" "}
                      {work.last_name}
                    </td>

                    <td>
                      {formatMoney(
                        work.total_amount,
                      )} €
                    </td>

                    <td className="is-paid">
                      {formatMoney(
                        work.paid_amount,
                      )} €
                    </td>

                    <td className="is-balance">
                      <strong>
                        {formatMoney(
                          work.remaining_amount,
                        )} €
                      </strong>
                    </td>

                    <td>
                      <span
                        className={
                          `payment-work-status is-${work.payment_status}`
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


                {!isLoading &&
                  filteredWorks.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="payments-empty"
                      >
                        Nuk ka punë për pagesë.
                      </td>
                    </tr>
                  )}


                {isLoading && (
                  <tr>
                    <td
                      colSpan={8}
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


        <section
          id="payments-panel-global"
          className="payment-global-section"
          role="tabpanel"
          aria-labelledby="payments-tab-global"
          hidden={
            activeView !== "global"
          }
        >

          <div className="payments-section-title">

            <span className="payments-section-icon is-summary">
              2
            </span>

            <div>
              <h2>Pagesa globale e mjekut</h2>

              <p>
                Të gjitha punët zgjidhen
                automatikisht. Mund të hiqni
                vetëm ato që nuk dëshironi
                t'i mbyllni.
              </p>
            </div>

          </div>


          <form
            className="payment-global-form"
            onSubmit={submitGlobalSettlement}
          >

            <div className="payment-global-fields">

              <label className="payments-field">
                <span>Mjeku</span>

                <select
                  value={globalDoctorId}
                  onChange={(event)=>{

                    setGlobalDoctorId(
                      event.target.value,
                    );

                    setIsGlobalWorksExpanded(
                      false,
                    );

                  }}
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
                <span>Data e pagesës</span>

                <input
                  type="date"
                  value={globalPaymentDate}
                  onChange={(event)=>
                    setGlobalPaymentDate(
                      event.target.value,
                    )
                  }
                  required
                />
              </label>

            </div>


            {globalDoctorId ? (

              <div className="payment-global-work-picker">

                <div className="payment-global-picker-header">

                  <div>
                    <strong>
                      Punët e zgjedhura për pagesë
                    </strong>

                    <span>
                      {
                        selectedGlobalWorkIds.length
                      } nga{" "}
                      {
                        selectedGlobalDoctorWorks.length
                      } të zgjedhura
                    </span>
                  </div>

                  <button
                    type="button"
                    className={
                      isGlobalWorksExpanded
                        ? "payment-global-toggle is-expanded"
                        : "payment-global-toggle"
                    }
                    onClick={()=>
                      setIsGlobalWorksExpanded(
                        (value)=>!value,
                      )
                    }
                    aria-expanded={
                      isGlobalWorksExpanded
                    }
                  >
                    <span>
                      {
                        isGlobalWorksExpanded
                          ? "Mbyll"
                          : "Hap"
                      }
                    </span>

                    <i aria-hidden="true">
                      ⌄
                    </i>
                  </button>

                </div>


                {isGlobalWorksExpanded && (
                  <div className="payment-global-works-collapsible-content">

                    <div className="payment-global-works-actions">

                      <button
                        type="button"
                        className="payment-select-all-button"
                        onClick={
                          selectAllGlobalWorks
                        }
                      >
                        Zgjidh të gjitha
                      </button>

                      <button
                        type="button"
                        className="payment-clear-all-button"
                        onClick={()=>
                          setSelectedGlobalWorkIds([])
                        }
                      >
                        Hiq të gjitha
                      </button>

                    </div>


                    <div className="payment-global-work-list">

                      {selectedGlobalDoctorWorks.map(
                        (work)=>(
                          <label
                            key={work.id}
                            className={
                              selectedGlobalWorkIds.includes(
                                String(work.id),
                              )
                                ? "is-selected"
                                : ""
                            }
                          >

                            <input
                              type="checkbox"
                              checked={
                                selectedGlobalWorkIds.includes(
                                  String(work.id),
                                )
                              }
                              onChange={()=>
                                toggleGlobalWork(
                                  String(work.id),
                                )
                              }
                            />

                            <span>
                              <strong>
                                {getWorkNumber(work)}
                              </strong>

                              <small>
                                {work.first_name}{" "}
                                {work.last_name}
                              </small>
                            </span>

                            <strong>
                              {formatMoney(
                                work.remaining_amount,
                              )} €
                            </strong>

                          </label>
                        ),
                      )}

                      {
                        selectedGlobalDoctorWorks
                          .length === 0 && (
                          <div className="payments-empty">
                            Ky mjek nuk ka punë të
                            hapura për pagesë.
                          </div>
                        )
                      }

                    </div>

                  </div>
                )}

              </div>

            ) : (

              <div className="payment-global-placeholder">
                Zgjidhni një mjek për të
                shfaqur punët e tij.
              </div>

            )}


            <div className="payment-global-summary">

              <div>
                <span>Borxhi global ekzistues</span>

                <strong>
                  {formatMoney(
                    selectedGlobalBalance
                      ?.global_balance ?? 0,
                  )} €
                </strong>
              </div>

              <div>
                <span>Punët e reja të zgjedhura</span>

                <strong>
                  {formatMoney(
                    selectedWorksTotal,
                  )} €
                </strong>
              </div>

              <div className="is-total">
                <span>Borxhi total</span>

                <strong>
                  {formatMoney(
                    Number(
                      selectedGlobalBalance
                        ?.global_balance ?? 0,
                    )
                    + selectedWorksTotal,
                  )} €
                </strong>
              </div>

            </div>


            <div className="payment-global-fields">

              <label className="payment-discount-toggle">

                <input
                  type="checkbox"
                  checked={globalHasDiscount}
                  onChange={(event)=>{

                    const checked =
                      event.target.checked;

                    setGlobalHasDiscount(
                      checked,
                    );

                    setGlobalDiscount(
                      checked
                        ? (
                            Number(
                              selectedGlobalBalance
                                ?.global_balance ?? 0,
                            )
                            + selectedWorksTotal
                          ).toFixed(2)
                        : "",
                    );

                  }}
                />

                <span />

                <div>
                  <strong>
                    Ndrysho shumën finale
                  </strong>

                  <small>
                    Vendosni shumën finale që
                    duhet të paguajë mjeku.
                  </small>
                </div>

              </label>


              {globalHasDiscount && (
                <label className="payments-field">
                  <span>
                    Shuma finale e faturuar
                  </span>

                  <div className="payments-amount-input">
                    <span>€</span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={globalDiscount}
                      onChange={(event)=>
                        setGlobalDiscount(
                          event.target.value,
                        )
                      }
                      placeholder="0.00"
                    />
                  </div>
                </label>
              )}


              <label className="payments-field">
                <span>Shuma e paguar</span>

                <div className="payments-amount-input">
                  <span>€</span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={globalAmount}
                    onChange={(event)=>
                      setGlobalAmount(
                        event.target.value,
                      )
                    }
                    placeholder="0.00"
                  />
                </div>
              </label>

            </div>


            <label className="payments-field">
              <span>Shënim</span>

              <textarea
                value={globalNote}
                onChange={(event)=>
                  setGlobalNote(
                    event.target.value,
                  )
                }
                rows={3}
                maxLength={500}
                placeholder="P.sh. pagesa e fundit të muajit..."
              />

              <small>
                {globalNote.length}/500
              </small>
            </label>


            <button
              type="submit"
              className="payments-submit-button"
              disabled={isSubmitting}
            >
              {
                isSubmitting
                  ? "Duke u regjistruar..."
                  : selectedGlobalWorkIds.length > 0
                    ? "Mbyll punët dhe regjistro pagesën"
                    : "Regjistro pagesën e borxhit"
              }
            </button>

          </form>

        </section>


        <section
          id="payments-panel-history"
          className="payments-history-card"
          role="tabpanel"
          aria-labelledby="payments-tab-history"
          hidden={
            activeView !== "history"
          }
        >

          <div className="payments-history-header">

            <div className="payments-section-title">

              <span className="payments-section-icon is-history">
                ▣
              </span>

              <div>
                <h2>Historiku i pagesave</h2>

                <p>
                  {payments.length} pagesa të
                  regjistruara
                </p>
              </div>

            </div>

          </div>


          <div className="payments-table-scroll">

            <table className="payments-table">

              <thead>
                <tr>
                  <th>Data</th>
                  <th>Mjeku</th>
                  <th>Shuma</th>
                  <th>Shënimi</th>
                </tr>
              </thead>

              <tbody>

                {payments.map((payment)=>(
                  <tr key={payment.id}>

                    <td>
                      {formatDate(
                        payment.payment_date,
                      )}
                    </td>

                    <td>
                      {payment.doctor_name}
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
                        {
                          payment.note ??
                          "Pa shënim"
                        }
                      </span>
                    </td>

                  </tr>
                ))}


                {!isLoading &&
                  payments.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="payments-empty"
                      >
                        Nuk ka pagesa të
                        regjistruara.
                      </td>
                    </tr>
                  )}

              </tbody>

            </table>

          </div>

        </section>


        {selectedWork && (
          <div
            className="payment-work-modal-backdrop"
            role="presentation"
            onMouseDown={(event)=>{

              if(
                event.target ===
                event.currentTarget
              ) {
                closeWork();
              }

            }}
          >

            <article
              className="payment-work-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Pagesa e punës"
            >

              <header>

                <div>
                  <span>
                    Puna{" "}
                    {getWorkNumber(
                      selectedWork,
                    )}
                  </span>

                  <h2>
                    {selectedWork.first_name}{" "}
                    {selectedWork.last_name}
                  </h2>

                  <p>
                    {selectedWork.doctor_name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeWork}
                  aria-label="Mbyll"
                >
                  ×
                </button>

              </header>


              <div className="payment-work-modal-content">

                <section className="payment-work-details">

                  <div className="payment-work-facts">

                    <div>
                      <span>Data</span>
                      <strong>
                        {formatDate(
                          selectedWork.work_date,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Materiali</span>
                      <strong>
                        {
                          selectedWork
                            .material_name ??
                          "-"
                        }
                      </strong>
                    </div>

                    <div>
                      <span>Ngjyra</span>
                      <strong>
                        {
                          selectedWork
                            .color_name ??
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

                  </div>


                  <div className="payment-work-description">

                    <h3>Përshkrimi</h3>

                    <p>
                      {
                        selectedWork.description ??
                        "Pa përshkrim"
                      }
                    </p>

                  </div>


                  <div className="payment-work-teeth">

                    <h3>Skema e dhëmbëve</h3>

                    <ToothMap
                      teeth={
                        selectedWork.teeth
                      }
                    />

                    <div className="payment-tooth-legend">
                      <span>
                        <i className="is-selected" />
                        Dhëmb
                      </span>

                      <span>
                        <i className="is-antar" />
                        Antar
                      </span>
                    </div>

                  </div>

                </section>


                <form
                  className="payment-work-form"
                  onSubmit={submitWorkPayment}
                >

                  <h3>Regjistro pagesën</h3>


                  <div className="payment-work-finance">

                    <div>
                      <span>Çmimi fillestar</span>

                      <strong>
                        {formatMoney(
                          selectedWork
                            .original_total_amount,
                        )} €
                      </strong>
                    </div>

                    <div>
                      <span>Çmimi final aktual</span>

                      <strong>
                        {formatMoney(
                          selectedWork
                            .total_amount,
                        )} €
                      </strong>
                    </div>

                    <div>
                      <span>Paguar</span>

                      <strong className="is-paid">
                        {formatMoney(
                          selectedWork
                            .paid_amount,
                        )} €
                      </strong>
                    </div>

                    <div className="is-balance">
                      <span>Mbetja</span>

                      <strong>
                        {formatMoney(
                          selectedWork
                            .remaining_amount,
                        )} €
                      </strong>
                    </div>

                  </div>


                  <label className="payment-discount-toggle">

                    <input
                      type="checkbox"
                      checked={workHasFinalPriceChange}
                      onChange={(event)=>{

                        const checked =
                          event.target.checked;

                        setWorkHasFinalPriceChange(
                          checked,
                        );

                        setWorkFinalAmount(
                          checked
                            ? Number(
                                selectedWork
                                  .total_amount,
                              ).toFixed(2)
                            : "",
                        );

                      }}
                    />

                    <span />

                    <div>
                      <strong>
                        Ndrysho çmimin final
                      </strong>

                      <small>
                        Mund të vendosni një
                        çmim final më të ulët
                        ose më të lartë.
                      </small>
                    </div>

                  </label>


                  {workHasFinalPriceChange && (
                    <label className="payments-field">
                      <span>
                        Çmimi final i faturuar
                      </span>

                      <div className="payments-amount-input">
                        <span>€</span>

                        <input
                          type="number"
                          min={
                            Number(
                              selectedWork
                                .paid_amount,
                            )
                          }
                          step="0.01"
                          value={workFinalAmount}
                          onChange={(event)=>
                            setWorkFinalAmount(
                              event.target.value,
                            )
                          }
                          placeholder={
                            selectedWork
                              .total_amount
                          }
                        />
                      </div>

                      <small>
                        Minimumi i lejuar:{" "}
                        {formatMoney(
                          selectedWork
                            .paid_amount,
                        )} €
                      </small>
                    </label>
                  )}


                  <label className="payments-field">
                    <span>Shuma e marrë</span>

                    <div className="payments-amount-input">
                      <span>€</span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={workAmount}
                        onChange={(event)=>
                          setWorkAmount(
                            event.target.value,
                          )
                        }
                        placeholder={
                          selectedWork
                            .remaining_amount
                        }
                      />
                    </div>
                  </label>


                  <button
                    type="button"
                    className="payment-fill-remaining"
                    onClick={()=>
                      setWorkAmount(
                        Number(
                          selectedWork
                            .remaining_amount,
                        ).toFixed(2),
                      )
                    }
                  >
                    Përdor shumën e plotë të
                    mbetur
                  </button>


                  <label className="payments-field">
                    <span>Data e pagesës</span>

                    <input
                      type="date"
                      value={workPaymentDate}
                      onChange={(event)=>
                        setWorkPaymentDate(
                          event.target.value,
                        )
                      }
                      required
                    />
                  </label>


                  <label className="payments-field">
                    <span>Shënim</span>

                    <textarea
                      value={workNote}
                      onChange={(event)=>
                        setWorkNote(
                          event.target.value,
                        )
                      }
                      maxLength={500}
                      rows={3}
                      placeholder="P.sh. kësti i parë..."
                    />

                    <small>
                      {workNote.length}/500
                    </small>
                  </label>


                  <button
                    type="submit"
                    className="payments-submit-button"
                    disabled={isSubmitting}
                  >
                    {
                      isSubmitting
                        ? "Duke u regjistruar..."
                        : "Regjistro pagesën"
                    }
                  </button>

                </form>

              </div>

            </article>

          </div>
        )}

      </main>

    </Layout>
  );

}
