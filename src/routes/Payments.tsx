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


const HISTORY_PAGE_SIZE = 10;


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


  const [historyPage,setHistoryPage] =
    useState(1);


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


  const selectedWorkFinalAmount =
    selectedWork
      ? (
          workHasFinalPriceChange
            ? Number(
                workFinalAmount ||
                selectedWork.total_amount,
              )
            : Number(
                selectedWork.total_amount,
              )
        )
      : 0;


  const selectedWorkRemainingAfterPayment =
    selectedWork
      ? Math.max(
          selectedWorkFinalAmount
          - Number(
              selectedWork.paid_amount || 0,
            )
          - Number(workAmount || 0),
          0,
        )
      : 0;


  const currentGlobalDebt =
    Number(
      selectedGlobalBalance
        ?.global_balance ?? 0,
    )
    + selectedWorksTotal;


  const currentGlobalFinalAmount =
    globalHasDiscount
      ? Number(
          globalDiscount ||
          currentGlobalDebt,
        )
      : currentGlobalDebt;


  const currentGlobalRemaining =
    Math.max(
      currentGlobalFinalAmount
      - Number(globalAmount || 0),
      0,
    );


  const historyTotalPages =
    Math.max(
      Math.ceil(
        payments.length /
        HISTORY_PAGE_SIZE,
      ),
      1,
    );


  const safeHistoryPage =
    Math.min(
      historyPage,
      historyTotalPages,
    );


  const paginatedPayments =
    payments.slice(
      (
        safeHistoryPage - 1
      ) * HISTORY_PAGE_SIZE,
      safeHistoryPage *
        HISTORY_PAGE_SIZE,
    );


  function changeHistoryPage(
    nextPage:number,
  ) {

    setHistoryPage(
      Math.min(
        Math.max(nextPage,1),
        historyTotalPages,
      ),
    );

  }


  return (
    <Layout>

      <main className="claude-payments">

        <section className="claude-payments-shell">

          <header className="claude-payments-header">

            <div>
              <span>Pagesat</span>

              <h1>Pagesat</h1>

              <p>
                Borxh i gjithsej{" "}
                <strong>
                  {formatMoney(
                    totalIndividualDebt
                    + totalGlobalDebt,
                  )} €
                </strong>
                {" · "}
                nga punët{" "}
                {formatMoney(
                  totalIndividualDebt,
                )} €
                {" · "}
                global{" "}
                {formatMoney(
                  totalGlobalDebt,
                )} €
              </p>
            </div>

            <button
              type="button"
              className="claude-payments-refresh"
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


          <nav
            className="claude-payment-tabs"
            role="tablist"
            aria-label="Seksionet e pagesave"
          >

            <button
              type="button"
              role="tab"
              aria-selected={
                activeView === "individual"
              }
              className={
                activeView === "individual"
                  ? "is-active"
                  : ""
              }
              onClick={()=>
                setActiveView("individual")
              }
            >
              Sipas punës
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={
                activeView === "global"
              }
              className={
                activeView === "global"
                  ? "is-active"
                  : ""
              }
              onClick={()=>
                setActiveView("global")
              }
            >
              Pagesë globale
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={
                activeView === "history"
              }
              className={
                activeView === "history"
                  ? "is-active"
                  : ""
              }
              onClick={()=>{

                setActiveView("history");
                setHistoryPage(1);

              }}
            >
              Historiku
            </button>

          </nav>


          {activeView === "individual" && (

            <section className="claude-payment-panel">

              <div className="claude-payment-toolbar">

                <label className="claude-payment-search">

                  <span>⌕</span>

                  <input
                    type="search"
                    value={search}
                    onChange={(event)=>
                      setSearch(
                        event.target.value,
                      )
                    }
                    placeholder="Kërko punën, pacientin, mjekun..."
                  />

                </label>


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
                    Më të vjetrat
                  </option>

                  <option value="desc">
                    Më të rejat
                  </option>
                </select>

              </div>


              <div className="claude-payment-work-list">

                {filteredWorks.map((work)=>(

                  <article
                    key={work.id}
                    className="claude-payment-work-row"
                  >

                    <button
                      type="button"
                      className="claude-payment-work-main"
                      onClick={()=>
                        openWork(work)
                      }
                    >

                      <strong>
                        {getWorkNumber(work)}
                      </strong>

                      <time>
                        {formatDate(
                          work.work_date,
                        )}
                      </time>

                      <span>
                        {work.doctor_name}
                      </span>

                      <span>
                        {work.first_name}{" "}
                        {work.last_name}
                      </span>

                      <b>
                        {formatMoney(
                          work.total_amount,
                        )} €
                      </b>

                      <b className="is-paid">
                        {formatMoney(
                          work.paid_amount,
                        )} €
                      </b>

                      <b
                        className={
                          Number(
                            work.remaining_amount,
                          ) > 0
                            ? "is-balance"
                            : "is-paid"
                        }
                      >
                        {formatMoney(
                          work.remaining_amount,
                        )} €
                      </b>

                    </button>


                    <button
                      type="button"
                      className={
                        work.payment_status ===
                        "partial"
                          ? "claude-payment-pay-button is-partial"
                          : "claude-payment-pay-button"
                      }
                      onClick={()=>
                        openWork(work)
                      }
                    >
                      €
                      {" "}
                      {
                        work.payment_status ===
                        "partial"
                          ? "Vazhdo pagesën"
                          : "Paguaj"
                      }
                    </button>

                  </article>

                ))}


                {!isLoading &&
                  filteredWorks.length === 0 && (

                    <div className="claude-payment-empty">
                      Nuk ka punë për pagesë.
                    </div>

                  )}


                {isLoading && (

                  <div className="claude-payment-empty">
                    Duke ngarkuar...
                  </div>

                )}

              </div>

            </section>

          )}


          {activeView === "global" && (

            <section className="claude-global-payment">

              <header>
                <span>Pagesë globale</span>

                <h2>
                  {
                    selectedGlobalBalance
                      ?.doctor_name ??
                    "Pagesa globale e mjekut"
                  }
                </h2>
              </header>


              <form
                onSubmit={
                  submitGlobalSettlement
                }
              >

                <div className="claude-global-primary-fields">

                  <label>
                    <span>Mjeku</span>

                    <select
                      value={globalDoctorId}
                      onChange={(event)=>{

                        setGlobalDoctorId(
                          event.target.value,
                        );

                        setIsGlobalWorksExpanded(
                          true,
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


                  <label>
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

                  <>

                    <div className="claude-global-debt">

                      <div>
                        <span>
                          Borxhi total
                        </span>

                        <strong>
                          {formatMoney(
                            currentGlobalDebt,
                          )} €
                        </strong>
                      </div>

                      <button
                        type="button"
                        onClick={()=>
                          setIsGlobalWorksExpanded(
                            (value)=>!value,
                          )
                        }
                      >
                        {
                          isGlobalWorksExpanded
                            ? "Mbyll listën"
                            : `Shiko ${selectedGlobalDoctorWorks.length} punë →`
                        }
                      </button>

                    </div>


                    {isGlobalWorksExpanded && (

                      <div className="claude-global-works">

                        <div className="claude-global-works-title">

                          <strong>
                            Punët e zgjedhura për
                            t'u mbyllur
                          </strong>

                          <button
                            type="button"
                            onClick={
                              selectAllGlobalWorks
                            }
                          >
                            {
                              selectedGlobalWorkIds
                                .length ===
                              selectedGlobalDoctorWorks
                                .length
                                ? "Hiq të gjitha"
                                : "Zgjidh të gjitha"
                            }
                          </button>

                        </div>


                        {selectedGlobalDoctorWorks.map(
                          (work)=>(

                            <label
                              key={work.id}
                              className={
                                selectedGlobalWorkIds
                                  .includes(
                                    String(work.id),
                                  )
                                  ? "is-selected"
                                  : ""
                              }
                            >

                              <input
                                type="checkbox"
                                checked={
                                  selectedGlobalWorkIds
                                    .includes(
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
                                  {" · "}
                                  {work.first_name}{" "}
                                  {work.last_name}
                                </strong>

                                <small>
                                  {formatDate(
                                    work.work_date,
                                  )}
                                </small>
                              </span>

                              <b>
                                {formatMoney(
                                  work.remaining_amount,
                                )} €
                              </b>

                            </label>

                          ),
                        )}


                        {
                          selectedGlobalDoctorWorks
                            .length === 0 && (

                            <div className="claude-payment-empty">
                              Ky mjek nuk ka punë
                              të hapura.
                            </div>

                          )
                        }

                      </div>

                    )}

                  </>

                ) : (

                  <div className="claude-global-placeholder">
                    Zgjidhni një mjek për të
                    shfaqur punët dhe borxhin e tij.
                  </div>

                )}


                <label className="claude-payment-switch">

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
                          ? currentGlobalDebt
                              .toFixed(2)
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

                  <label className="claude-payment-field">
                    <span>
                      Shuma finale e faturuar
                    </span>

                    <div className="claude-money-input">
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
                      />
                    </div>
                  </label>

                )}


                <label className="claude-payment-field">
                  <span>Shuma e paguar tani</span>

                  <div className="claude-money-input">
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


                <label className="claude-payment-field">
                  <span>Shënim</span>

                  <input
                    type="text"
                    value={globalNote}
                    onChange={(event)=>
                      setGlobalNote(
                        event.target.value,
                      )
                    }
                    maxLength={500}
                    placeholder="P.sh. pagesa e fundit të muajit..."
                  />
                </label>


                <div className="claude-global-bottom">

                  <dl>

                    <div>
                      <dt>Borxhi para</dt>

                      <dd>
                        {formatMoney(
                          currentGlobalFinalAmount,
                        )} €
                      </dd>
                    </div>

                    <div>
                      <dt>Paguar tani</dt>

                      <dd className="is-paid">
                        {formatMoney(
                          Number(
                            globalAmount || 0,
                          ),
                        )} €
                      </dd>
                    </div>

                    <div>
                      <dt>Borxhi i mbetur</dt>

                      <dd className="is-balance">
                        {formatMoney(
                          currentGlobalRemaining,
                        )} €
                      </dd>
                    </div>

                  </dl>


                  <button
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {
                      isSubmitting
                        ? "Duke u regjistruar..."
                        : selectedGlobalWorkIds
                            .length > 0
                          ? `Mbyll ${selectedGlobalWorkIds.length} punë dhe regjistro pagesën`
                          : "Regjistro pagesën"
                    }
                  </button>

                </div>

              </form>

            </section>

          )}


          {activeView === "history" && (

            <section className="claude-payment-history">

              <header>

                <h2>
                  Historiku i pagesave
                </h2>

                <p>
                  {payments.length} pagesa të
                  regjistruara këtë muaj
                </p>

              </header>


              <div>

                {paginatedPayments.map((payment)=>(

                  <article key={payment.id}>

                    <span className="claude-history-icon">
                      €
                    </span>

                    <div>
                      <strong>
                        {payment.doctor_name}
                      </strong>

                      <small>
                        {
                          payment.note
                            ? payment.note
                            : "Pa shënim"
                        }
                      </small>
                    </div>

                    <time>
                      {formatDate(
                        payment.payment_date,
                      )}
                    </time>

                    <b>
                      {formatMoney(
                        payment.amount,
                      )} €
                    </b>

                  </article>

                ))}


                {!isLoading &&
                  payments.length === 0 && (

                    <div className="claude-payment-empty">
                      Nuk ka pagesa të
                      regjistruara.
                    </div>

                  )}

              </div>


              {payments.length >
                HISTORY_PAGE_SIZE && (

                <nav
                  className="claude-history-pagination"
                  aria-label="Faqet e historikut"
                >

                  <button
                    type="button"
                    className="claude-history-page-arrow"
                    onClick={()=>
                      changeHistoryPage(
                        safeHistoryPage - 1,
                      )
                    }
                    disabled={
                      safeHistoryPage === 1
                    }
                    aria-label="Faqja e mëparshme"
                  >
                    ‹
                  </button>


                  <div className="claude-history-page-numbers">

                    {Array.from(
                      {
                        length:
                          historyTotalPages,
                      },
                      (_,index)=>index + 1,
                    ).map((page)=>(

                      <button
                        type="button"
                        key={page}
                        className={
                          page ===
                          safeHistoryPage
                            ? "is-active"
                            : ""
                        }
                        onClick={()=>
                          changeHistoryPage(
                            page,
                          )
                        }
                        aria-current={
                          page ===
                          safeHistoryPage
                            ? "page"
                            : undefined
                        }
                      >
                        {page}
                      </button>

                    ))}

                  </div>


                  <button
                    type="button"
                    className="claude-history-page-arrow"
                    onClick={()=>
                      changeHistoryPage(
                        safeHistoryPage + 1,
                      )
                    }
                    disabled={
                      safeHistoryPage ===
                      historyTotalPages
                    }
                    aria-label="Faqja tjetër"
                  >
                    ›
                  </button>

                </nav>

              )}


              {payments.length > 0 && (

                <p className="claude-history-page-status">
                  Duke shfaqur{" "}
                  {
                    (
                      safeHistoryPage - 1
                    ) * HISTORY_PAGE_SIZE
                    + 1
                  }
                  {"–"}
                  {
                    Math.min(
                      safeHistoryPage *
                        HISTORY_PAGE_SIZE,
                      payments.length,
                    )
                  }
                  {" nga "}
                  {payments.length}
                  {" pagesa"}
                </p>

              )}

            </section>

          )}

        </section>


        {selectedWork && (

          <div
            className="claude-work-payment-backdrop"
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
              className="claude-work-payment-card"
              role="dialog"
              aria-modal="true"
              aria-label="Pagesa e punës"
            >

              <header>

                <div>
                  <span>
                    Regjistro pagesë
                  </span>

                  <h2>
                    Puna{" "}
                    {getWorkNumber(
                      selectedWork,
                    )}
                  </h2>

                  <p>
                    {selectedWork.first_name}{" "}
                    {selectedWork.last_name}
                    {" · "}
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


              <form
                onSubmit={submitWorkPayment}
              >

                <div className="claude-work-current-balance">

                  <span>Mbetja aktuale</span>

                  <strong>
                    {formatMoney(
                      selectedWork
                        .remaining_amount,
                    )} €
                  </strong>

                </div>


                <label className="claude-payment-field">
                  <span>Shuma e pagesës</span>

                  <div className="claude-money-input">
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


                <div className="claude-work-quick-actions">

                  <button
                    type="button"
                    onClick={()=>
                      setWorkAmount(
                        Number(
                          selectedWork
                            .remaining_amount,
                        ).toFixed(2),
                      )
                    }
                  >
                    Pagesë e plotë
                  </button>

                  <button
                    type="button"
                    onClick={()=>
                      setWorkAmount(
                        (
                          Number(
                            selectedWork
                              .remaining_amount,
                          ) / 2
                        ).toFixed(2),
                      )
                    }
                  >
                    Gjysma
                  </button>

                  <button
                    type="button"
                    onClick={()=>
                      setWorkAmount("")
                    }
                  >
                    Shumë tjetër
                  </button>

                </div>


                <label className="claude-simple-checkbox">

                  <input
                    type="checkbox"
                    checked={
                      workHasFinalPriceChange
                    }
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

                  <span>
                    Ndrysho çmimin final të
                    faturuar
                  </span>

                </label>


                {workHasFinalPriceChange && (

                  <label className="claude-payment-field">
                    <span>
                      Çmimi final i faturuar
                    </span>

                    <div className="claude-money-input">
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
                      />
                    </div>
                  </label>

                )}


                <label className="claude-payment-field">
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


                <label className="claude-payment-field">
                  <span>
                    Shënim (opsionale)
                  </span>

                  <input
                    type="text"
                    value={workNote}
                    onChange={(event)=>
                      setWorkNote(
                        event.target.value,
                      )
                    }
                    maxLength={500}
                    placeholder="P.sh. pagesë në dorë..."
                  />
                </label>


                <div className="claude-work-payment-bottom">

                  <dl>

                    <div>
                      <dt>Para pagesës</dt>

                      <dd>
                        {formatMoney(
                          selectedWorkFinalAmount
                          - Number(
                              selectedWork
                                .paid_amount,
                            ),
                        )} €
                      </dd>
                    </div>

                    <div>
                      <dt>Pas pagesës</dt>

                      <dd
                        className={
                          selectedWorkRemainingAfterPayment
                            > 0
                              ? "is-balance"
                              : "is-paid"
                        }
                      >
                        {
                          selectedWorkRemainingAfterPayment
                            > 0
                              ? `${formatMoney(
                                  selectedWorkRemainingAfterPayment,
                                )} €`
                              : "Paguar plotësisht"
                        }
                      </dd>
                    </div>

                  </dl>


                  <button
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {
                      isSubmitting
                        ? "Duke u regjistruar..."
                        : "Regjistro pagesën"
                    }
                  </button>

                </div>

              </form>

            </article>

          </div>

        )}

      </main>

    </Layout>
  );

}
