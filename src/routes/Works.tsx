import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Layout from "@/components/Layout";
import AppToast from "@/components/AppToast";
import { useMonth } from "@/context/MonthContext";
import { api } from "@/lib/api";
import { useUnsavedChanges } from "@/lib/useUnsavedChanges";

import { useConfirm } from "@/context/ConfirmContext";


type Doctor = {
  id:string;
  name:string;
};


type Material = {
  id:string;
  name:string;
  active:boolean;
};


type Color = {
  id:string;
  name:string;
};


type ToothSelection = {
  number:number;
  is_antar:boolean;
};


type Work = {
  id:string;
  doctor_id:string;
  patient_id:string;
  material_id:string|null;
  color_id:string|null;
  year:number;
  month:number;
  monthly_number:number;
  work_date:string;
  description:string|null;
  is_repeat:boolean;
  pricing_mode:"per_tooth"|"fixed_total";
  price_per_tooth:string;
  first_name:string;
  last_name:string;
  doctor_name:string;
  material_name:string|null;
  color_name:string|null;
  total_amount:string;
  status:"active"|"cancelled";
  teeth:ToothSelection[];
};


type MessageType = "success"|"error"|"";


const upperLeft = [18,17,16,15,14,13,12,11];
const upperRight = [21,22,23,24,25,26,27,28];
const lowerLeft = [48,47,46,45,44,43,42,41];
const lowerRight = [31,32,33,34,35,36,37,38];

const allTeeth = [
  ...upperLeft,
  ...upperRight,
  ...lowerLeft,
  ...lowerRight,
];


function getWorkNumber(work:Work){

  return [
    work.year,
    String(work.month).padStart(2,"0"),
    String(work.monthly_number).padStart(3,"0"),
  ].join("-");

}


function formatDate(value:string){

  return new Date(value).toLocaleDateString(
    "sq-AL",
    {
      day:"2-digit",
      month:"2-digit",
      year:"numeric",
    }
  );

}


function getTodayInputDate(){

  const today = new Date();

  const year =
    today.getFullYear();

  const month =
    String(
      today.getMonth() + 1,
    ).padStart(2,"0");

  const day =
    String(
      today.getDate(),
    ).padStart(2,"0");


  return `${year}-${month}-${day}`;

}


function cycleTooth(
  current:ToothSelection[],
  toothNumber:number
){

  const existing = current.find(
    (tooth)=>tooth.number === toothNumber
  );


  if(!existing){

    return [
      ...current,
      {
        number:toothNumber,
        is_antar:false,
      },
    ];

  }


  if(!existing.is_antar){

    return current.map((tooth)=>
      tooth.number === toothNumber
        ? {
            ...tooth,
            is_antar:true,
          }
        : tooth
    );

  }


  return current.filter(
    (tooth)=>tooth.number !== toothNumber
  );

}


function serializeTeeth(
  teeth:ToothSelection[],
) {

  return teeth
    .map(
      (tooth)=>({
        number:tooth.number,
        is_antar:tooth.is_antar,
      }),
    )
    .sort(
      (first,second)=>
        first.number - second.number,
    )
    .map(
      (tooth)=>
        `${tooth.number}:${tooth.is_antar}`,
    )
    .join("|");

}


export default function Works(){

  const {
    confirmAction,
  } = useConfirm();

  const {
    selectedMonth,
  } = useMonth();

  const [doctors,setDoctors]=useState<Doctor[]>([]);
  const [materials,setMaterials]=useState<Material[]>([]);
  const [colors,setColors]=useState<Color[]>([]);
  const [works,setWorks]=useState<Work[]>([]);

  const [isLoading,setIsLoading]=useState(true);

  const [createOpen,setCreateOpen]=
    useState(false);

  const [doctorId,setDoctorId]=useState("");
  const [workDate,setWorkDate]=
    useState(getTodayInputDate);
  const [firstName,setFirstName]=useState("");
  const [lastName,setLastName]=useState("");
  const [materialId,setMaterialId]=useState("");
  const [colorId,setColorId]=useState("");
  const [description,setDescription]=useState("");
  const [isRepeat,setIsRepeat]=useState(false);
  const [pricingMode,setPricingMode]=
    useState<"per_tooth"|"fixed_total">(
      "per_tooth"
    );
  const [price,setPrice]=useState("");
  const [selectedTeeth,setSelectedTeeth]=useState<
    ToothSelection[]
  >([]);

  const [isSubmitting,setIsSubmitting]=useState(false);
  const [formMessage,setFormMessage]=useState("");
  const [formMessageType,setFormMessageType]=
    useState<MessageType>("");

  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("all");

  const [selectedWork,setSelectedWork]=
    useState<Work|null>(null);

  const [editingWork,setEditingWork]=
    useState<Work|null>(null);

  const [actionWorkId,setActionWorkId]=
    useState<string|null>(null);

  const [historyMessage,setHistoryMessage]=useState("");
  const [historyMessageType,setHistoryMessageType]=
    useState<MessageType>("");

  const [editDoctorId,setEditDoctorId]=useState("");
  const [editFirstName,setEditFirstName]=useState("");
  const [editLastName,setEditLastName]=useState("");
  const [editMaterialId,setEditMaterialId]=useState("");
  const [editColorId,setEditColorId]=useState("");
  const [editDescription,setEditDescription]=useState("");
  const [editIsRepeat,setEditIsRepeat]=useState(false);
  const [editPricingMode,setEditPricingMode]=
    useState<"per_tooth"|"fixed_total">(
      "per_tooth"
    );
  const [editPrice,setEditPrice]=useState("");
  const [editTeeth,setEditTeeth]=useState<
    ToothSelection[]
  >([]);
  const [editMessage,setEditMessage]=useState("");
  const [isEditing,setIsEditing]=useState(false);


  const createWorkIsDirty =
    createOpen &&
    Boolean(
      doctorId ||
      workDate !== getTodayInputDate() ||
      firstName.trim() ||
      lastName.trim() ||
      materialId ||
      colorId ||
      description.trim() ||
      isRepeat ||
      pricingMode !== "per_tooth" ||
      price ||
      selectedTeeth.length > 0,
    );


  const editWorkIsDirty =
    useMemo(
      ()=>{

        if(!editingWork) {
          return false;
        }


        return (
          editDoctorId !==
            String(editingWork.doctor_id) ||

          editFirstName !==
            editingWork.first_name ||

          editLastName !==
            editingWork.last_name ||

          editMaterialId !==
            (
              editingWork.material_id
                ? String(
                    editingWork.material_id,
                  )
                : ""
            ) ||

          editColorId !==
            (
              editingWork.color_id
                ? String(
                    editingWork.color_id,
                  )
                : ""
            ) ||

          editDescription !==
            (
              editingWork.description ?? ""
            ) ||

          editIsRepeat !==
            editingWork.is_repeat ||

          editPricingMode !==
            editingWork.pricing_mode ||

          editPrice !==
            String(
              editingWork.pricing_mode ===
              "fixed_total"
                ? editingWork.total_amount
                : editingWork.price_per_tooth
            ) ||

          serializeTeeth(editTeeth) !==
            serializeTeeth(
              editingWork.teeth,
            )
        );

      },
      [
        editColorId,
        editDescription,
        editDoctorId,
        editIsRepeat,
        editPricingMode,
        editFirstName,
        editLastName,
        editMaterialId,
        editPrice,
        editTeeth,
        editingWork,
      ],
    );


  useUnsavedChanges(
    "works-create-form",
    createWorkIsDirty,
  );

  useUnsavedChanges(
    "works-edit-form",
    editWorkIsDirty,
  );


  const editMaterials =
    useMemo(
      ()=>{

        if(
          !editingWork?.material_id ||
          !editingWork.material_name
        ) {
          return materials;
        }


        const currentMaterialExists =
          materials.some(
            (material)=>
              String(material.id) ===
              String(
                editingWork.material_id,
              ),
          );


        if(currentMaterialExists) {
          return materials;
        }


        return [
          ...materials,

          {
            id:String(
              editingWork.material_id,
            ),

            name:
              `${editingWork.material_name} (jo aktiv)`,

            active:false,
          },
        ];

      },
      [
        editingWork,
        materials,
      ],
    );


  async function loadData(){

    setIsLoading(true);

    try{

      const [
        referencesResponse,
        worksResponse,
      ] = await Promise.all([
        api("/works/references"),
        api(
          `/works?month=${encodeURIComponent(
            selectedMonth,
          )}`,
        ),
      ]);


      if(
        !referencesResponse.ok ||
        !worksResponse.ok
      ){

        throw new Error(
          "Impossible de charger les données"
        );

      }


      const references =
        await referencesResponse.json();

      const worksData =
        await worksResponse.json();


      setDoctors(references.doctors ?? []);
      setMaterials(references.materials ?? []);
      setColors(references.colors ?? []);
      setWorks(worksData ?? []);


    }catch(error){

      console.error(error);

      setHistoryMessage(
        "Të dhënat nuk mund të ngarkoheshin."
      );
      setHistoryMessageType("error");


    }finally{

      setIsLoading(false);

    }

  }


  useEffect(()=>{

    loadData();

  },[
    selectedMonth,
  ]);


  useEffect(()=>{

    if(
      !selectedWork &&
      !editingWork &&
      !createOpen
    ){
      return;
    }


    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";


    function handleKeyDown(event:KeyboardEvent){

      if(event.key !== "Escape"){
        return;
      }


      event.preventDefault();
      event.stopImmediatePropagation();


      if(createOpen){

        if(createWorkIsDirty){

          setFormMessage(
            "Nuk mund ta mbyllni me Esc sepse formulari ka të dhëna të paruajtura.",
          );

          setFormMessageType("error");

          return;

        }


        setCreateOpen(false);
        return;

      }


      if(editingWork){

        if(editWorkIsDirty){

          setEditMessage(
            "Nuk mund ta mbyllni me Esc sepse ka ndryshime të paruajtura. Ruajini ose përdorni butonin Anulo.",
          );

          return;

        }


        setEditingWork(null);
        setEditMessage("");
        return;

      }


      setSelectedWork(null);

    }


    window.addEventListener(
      "keydown",
      handleKeyDown
    );


    return ()=>{

      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );

    };

  },[
    selectedWork,
    editingWork,
    createOpen,
    createWorkIsDirty,
    editWorkIsDirty,
  ]);


  useEffect(()=>{

    function openCreateWork(){

      sessionStorage.removeItem(
        "dentaltrack:open-create-work",
      );

      setFormMessage("");
      setFormMessageType("");
      setWorkDate(getTodayInputDate());
      setCreateOpen(true);

    }


    if(
      sessionStorage.getItem(
        "dentaltrack:open-create-work",
      ) === "1"
    ) {
      openCreateWork();
    }


    window.addEventListener(
      "dentaltrack:open-create-work",
      openCreateWork,
    );


    return ()=>{

      window.removeEventListener(
        "dentaltrack:open-create-work",
        openCreateWork,
      );

    };

  },[]);


  const selectedAntarCount = useMemo(
    ()=>selectedTeeth.filter(
      (tooth)=>tooth.is_antar
    ).length,
    [selectedTeeth]
  );


  const totalAmount = useMemo(
    ()=>{
      const numericPrice =
        Number(price || 0);

      return pricingMode === "fixed_total"
        ? numericPrice
        : numericPrice * selectedTeeth.length;
    },
    [
      price,
      pricingMode,
      selectedTeeth,
    ]
  );


  const filteredWorks = useMemo(()=>{

    const normalizedSearch =
      search.trim().toLowerCase();


    return works.filter((work)=>{

      const searchableText = [
        getWorkNumber(work),
        work.first_name,
        work.last_name,
        work.doctor_name,
        work.material_name ?? "",
        work.color_name ?? "",
        work.description ?? "",
      ]
        .join(" ")
        .toLowerCase();


      const matchesSearch =
        searchableText.includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        work.status === statusFilter;


      return matchesSearch && matchesStatus;

    });

  },[works,search,statusFilter]);


  async function closeCreateWork(){

    if(isSubmitting){
      return;
    }


    if(createWorkIsDirty){

      const confirmed =
        await confirmAction({
          title:"Mbyll formularin",

          message:
            "Ka të dhëna të paruajtura. A dëshironi ta mbyllni formularin?",

          confirmLabel:"Mbyll",
          tone:"warning",
        });


      if(!confirmed){
        return;
      }

    }


    setCreateOpen(false);
    setFormMessage("");
    setFormMessageType("");

  }


  function toggleTooth(toothNumber:number){

    setSelectedTeeth((current)=>
      cycleTooth(current,toothNumber)
    );

  }


  function selectAllTeeth(){

    setSelectedTeeth((current)=>{

      const currentByNumber =
        new Map(
          current.map(
            (tooth)=>[
              tooth.number,
              tooth,
            ],
          ),
        );


      return allTeeth.map(
        (toothNumber)=>(
          currentByNumber.get(toothNumber) ?? {
            number:toothNumber,
            is_antar:false,
          }
        ),
      );

    });

  }


  function toggleEditTooth(toothNumber:number){

    setEditTeeth((current)=>
      cycleTooth(current,toothNumber)
    );

  }


  function renderToothButton(
    toothNumber:number,
    selected:ToothSelection[],
    onToggle:(number:number)=>void
  ){

    const tooth = selected.find(
      (item)=>item.number === toothNumber
    );


    const stateClass = tooth
      ? tooth.is_antar
        ? "is-antar"
        : "is-normal"
      : "";


    return (
      <button
        type="button"
        key={toothNumber}
        className={`works-tooth ${stateClass}`}
        onClick={()=>onToggle(toothNumber)}
        aria-label={
          tooth?.is_antar
            ? `Dhëmbi ${toothNumber}, Antar`
            : tooth
              ? `Dhëmbi ${toothNumber}, normal`
              : `Zgjidh dhëmbin ${toothNumber}`
        }
      >
        <span>{toothNumber}</span>
      </button>
    );

  }


  function renderQuadrant(
    title:string,
    teeth:number[],
    selected:ToothSelection[],
    onToggle:(number:number)=>void,
    className:string
  ){

    return (
      <div className={`works-quadrant ${className}`}>

        <span className="works-quadrant-label">
          {title}
        </span>

        <div className="works-tooth-row">
          {teeth.map((tooth)=>
            renderToothButton(
              tooth,
              selected,
              onToggle
            )
          )}
        </div>

      </div>
    );

  }


  async function createWork(
    event:React.FormEvent
  ){

    event.preventDefault();

    setFormMessage("");
    setFormMessageType("");


    const cleanFirstName =
      firstName.trim();

    const cleanLastName =
      lastName.trim();

    const cleanDescription =
      description.trim();

    const numericPrice =
      Number(price);


    if(
      !/^\d{4}-\d{2}-\d{2}$/.test(
        workDate,
      )
    ){

      setFormMessage(
        "Zgjidhni një datë të vlefshme për punën."
      );
      setFormMessageType("error");
      return;

    }


    if(!doctorId){

      setFormMessage("Zgjidhni mjekun.");
      setFormMessageType("error");
      return;

    }


    if(!cleanFirstName || !cleanLastName){

      setFormMessage(
        "Shkruani emrin dhe mbiemrin e pacientit."
      );
      setFormMessageType("error");
      return;

    }


    if(cleanDescription.length > 2000){

      setFormMessage(
        "Përshkrimi nuk mund të ketë më shumë se 2000 karaktere."
      );
      setFormMessageType("error");
      return;

    }


    if(selectedTeeth.length === 0){

      setFormMessage(
        "Zgjidhni të paktën një dhëmb."
      );
      setFormMessageType("error");
      return;

    }


    if(
      !Number.isFinite(numericPrice) ||
      numericPrice < 0 ||
      (
        !isRepeat &&
        numericPrice === 0
      )
    ){

      setFormMessage(
        isRepeat
          ? "Çmimi nuk mund të jetë negativ."
          : pricingMode === "fixed_total"
            ? "Çmimi total duhet të jetë më i madh se 0."
            : "Çmimi për dhëmb duhet të jetë më i madh se 0."
      );
      setFormMessageType("error");
      return;

    }


    setIsSubmitting(true);


    try{

      const response = await api(
        "/works",
        {
          method:"POST",
          body:JSON.stringify({
            doctor_id:Number(doctorId),
            work_date:workDate,
            patient_first_name:cleanFirstName,
            patient_last_name:cleanLastName,
            material_id:materialId
              ? Number(materialId)
              : null,
            color_id:colorId
              ? Number(colorId)
              : null,
            description:cleanDescription,
            is_repeat:isRepeat,
            pricing_mode:pricingMode,
            price_per_tooth:numericPrice,
            teeth:selectedTeeth,
          }),
        }
      );


      if(!response.ok){

        let message =
          "Puna nuk mund të krijohej.";

        try{

          const data = await response.json();

          if(data?.error === "invalid_teeth"){
            message =
              "Zgjedhja e dhëmbëve nuk është valide.";
          }

          if(data?.error === "invalid_price"){
            message =
              "Çmimi nuk është valid.";
          }

          if(data?.error === "invalid_work_date"){
            message =
              "Data e punës nuk është valide.";
          }

          if(data?.error === "description_too_long"){
            message =
              "Përshkrimi nuk mund të ketë më shumë se 2000 karaktere.";
          }

        }catch{
          // Garder le message par défaut.
        }


        setFormMessage(message);
        setFormMessageType("error");
        return;

      }


      setDoctorId("");
      setWorkDate(getTodayInputDate());
      setFirstName("");
      setLastName("");
      setMaterialId("");
      setColorId("");
      setDescription("");
      setIsRepeat(false);
      setPricingMode("per_tooth");
      setPrice("");
      setSelectedTeeth([]);

      setFormMessage(
        "Puna u shtua me sukses."
      );
      setFormMessageType("success");

      setCreateOpen(false);

      setHistoryMessage(
        "Puna u shtua me sukses."
      );
      setHistoryMessageType("success");

      await loadData();


    }catch(error){

      console.error(error);

      setFormMessage(
        "Ndodhi një gabim gjatë komunikimit me serverin."
      );
      setFormMessageType("error");


    }finally{

      setIsSubmitting(false);

    }

  }


  async function updateWorkStatus(
    work:Work
  ){

    const nextStatus =
      work.status === "active"
        ? "cancelled"
        : "active";

    const confirmationMessage =
      nextStatus === "cancelled"
        ? `A dëshironi ta anuloni punën ${getWorkNumber(work)}?`
        : `A dëshironi ta riaktivizoni punën ${getWorkNumber(work)}?`;


    const confirmed =
      await confirmAction({
        title:
          nextStatus === "cancelled"
            ? "Anulo punën"
            : "Riaktivizo punën",

        message:confirmationMessage,

        confirmLabel:
          nextStatus === "cancelled"
            ? "Anulo punën"
            : "Riaktivizo",

        tone:
          nextStatus === "cancelled"
            ? "danger"
            : "primary",
      });


    if(!confirmed){
      return;
    }


    setActionWorkId(work.id);
    setHistoryMessage("");
    setHistoryMessageType("");


    try{

      const response = await api(
        `/works/${work.id}/status`,
        {
          method:"PATCH",
          body:JSON.stringify({
            status:nextStatus,
          }),
        }
      );


      if(!response.ok){

        throw new Error(
          "Status update failed"
        );

      }


      setWorks((current)=>
        current.map((item)=>
          item.id === work.id
            ? {
                ...item,
                status:nextStatus,
              }
            : item
        )
      );


      setSelectedWork((current)=>
        current?.id === work.id
          ? {
              ...current,
              status:nextStatus,
            }
          : current
      );


      setHistoryMessage(
        nextStatus === "cancelled"
          ? "Puna u anulua me sukses."
          : "Puna u riaktivizua me sukses."
      );
      setHistoryMessageType("success");


    }catch(error){

      console.error(error);

      setHistoryMessage(
        "Statusi nuk mund të ndryshohej."
      );
      setHistoryMessageType("error");


    }finally{

      setActionWorkId(null);

    }

  }


  function openEditWork(work:Work){

    setEditingWork(work);

    setEditDoctorId(
      String(work.doctor_id)
    );

    setEditFirstName(work.first_name);
    setEditLastName(work.last_name);

    setEditMaterialId(
      work.material_id
        ? String(work.material_id)
        : ""
    );

    setEditColorId(
      work.color_id
        ? String(work.color_id)
        : ""
    );

    setEditDescription(
      work.description ?? ""
    );

    setEditIsRepeat(
      work.is_repeat
    );

    setEditPricingMode(
      work.pricing_mode
    );

    setEditPrice(
      String(
        work.pricing_mode === "fixed_total"
          ? work.total_amount
          : work.price_per_tooth
      )
    );

    setEditTeeth(
      work.teeth.map((tooth)=>({
        ...tooth,
      }))
    );

    setEditMessage("");

  }


  async function submitEditWork(
    event:React.FormEvent
  ){

    event.preventDefault();

    if(!editingWork){
      return;
    }


    setEditMessage("");


    const cleanFirstName =
      editFirstName.trim();

    const cleanLastName =
      editLastName.trim();

    const cleanDescription =
      editDescription.trim();

    const numericPrice =
      Number(editPrice);


    if(
      !editDoctorId ||
      !cleanFirstName ||
      !cleanLastName
    ){

      setEditMessage(
        "Plotësoni mjekun dhe të dhënat e pacientit."
      );
      return;

    }


    if(cleanDescription.length > 2000){

      setEditMessage(
        "Përshkrimi nuk mund të ketë më shumë se 2000 karaktere."
      );
      return;

    }


    if(editTeeth.length === 0){

      setEditMessage(
        "Zgjidhni të paktën një dhëmb."
      );
      return;

    }


    if(
      !Number.isFinite(numericPrice) ||
      numericPrice < 0 ||
      (
        !editIsRepeat &&
        numericPrice === 0
      )
    ){

      setEditMessage(
        editIsRepeat
          ? "Çmimi nuk mund të jetë negativ."
          : "Çmimi duhet të jetë më i madh se 0."
      );
      return;

    }


    const confirmed =
      await confirmAction({
        title:"Ruaj ndryshimet",

        message:
          `A dëshironi t'i ruani ndryshimet për punën ${getWorkNumber(editingWork)}?`,

        confirmLabel:"Ruaj",
        tone:"primary",
      });


    if(!confirmed){
      return;
    }


    setIsEditing(true);


    try{

      const response = await api(
        `/works/${editingWork.id}`,
        {
          method:"PUT",
          body:JSON.stringify({
            doctor_id:Number(editDoctorId),
            patient_first_name:cleanFirstName,
            patient_last_name:cleanLastName,
            material_id:editMaterialId
              ? Number(editMaterialId)
              : null,
            color_id:editColorId
              ? Number(editColorId)
              : null,
            description:cleanDescription,
            is_repeat:editIsRepeat,
            pricing_mode:editPricingMode,
            price_per_tooth:numericPrice,
            teeth:editTeeth,
          }),
        }
      );


      if(!response.ok){

        throw new Error(
          "Work update failed"
        );

      }


      setEditingWork(null);
      setSelectedWork(null);

      setHistoryMessage(
        "Ndryshimet u ruajtën me sukses."
      );
      setHistoryMessageType("success");

      await loadData();


    }catch(error){

      console.error(error);

      setEditMessage(
        "Ndryshimet nuk mund të ruheshin."
      );


    }finally{

      setIsEditing(false);

    }

  }


  return (

    <Layout>

      <main className="works-page">

        <header className="works-page-header">

          <div>
            <span className="works-page-eyebrow">
              Menaxhimi i laboratorit
            </span>

            <h1>Punët</h1>

            <p>
              Krijoni, kontrolloni dhe menaxhoni
              punët dentare.
            </p>
          </div>

        </header>


        {createOpen && (

          <div
            className="works-create-backdrop"
            role="presentation"
            onMouseDown={(event)=>{

              if(
                event.target ===
                event.currentTarget
              ){
                void closeCreateWork();
              }

            }}
          >

        <section className="works-create-card works-create-panel">

          <div className="works-section-title">

            <span className="works-section-icon">
              +
            </span>

            <div>
              <h2>Krijo punë</h2>
              <p>
                Plotësoni të dhënat dhe zgjidhni
                dhëmbët.
              </p>
            </div>

          </div>


          <button
            type="button"
            className="works-create-close"
            onClick={()=>
              void closeCreateWork()
            }
            disabled={isSubmitting}
            aria-label="Mbyll formularin"
          >
            ×
          </button>


          <form
            className="works-create-form"
            onSubmit={createWork}
          >

            <div className="works-form-fields">

              <label className="works-field">

                <span>Mjeku</span>

                <select
                  value={doctorId}
                  onChange={(event)=>
                    setDoctorId(
                      event.target.value
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


              <label className="works-field">

                <span>Data e punës</span>

                <input
                  type="date"
                  value={workDate}
                  onChange={(event)=>
                    setWorkDate(
                      event.target.value
                    )
                  }
                  required
                />

              </label>


              <label className="works-field">

                <span>Emri i pacientit</span>

                <input
                  value={firstName}
                  onChange={(event)=>
                    setFirstName(
                      event.target.value
                    )
                  }
                  placeholder="Shkruaj emrin"
                  required
                />

              </label>


              <label className="works-field">

                <span>Mbiemri i pacientit</span>

                <input
                  value={lastName}
                  onChange={(event)=>
                    setLastName(
                      event.target.value
                    )
                  }
                  placeholder="Shkruaj mbiemrin"
                  required
                />

              </label>


              <div className="works-fields-inline">

                <label className="works-field">

                  <span>Materiali</span>

                  <select
                    value={materialId}
                    onChange={(event)=>
                      setMaterialId(
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Zgjidh materialin
                    </option>

                    {materials.map((material)=>(
                      <option
                        key={material.id}
                        value={material.id}
                      >
                        {material.name}
                      </option>
                    ))}
                  </select>

                </label>


                <label className="works-field">

                  <span>Ngjyra</span>

                  <select
                    value={colorId}
                    onChange={(event)=>
                      setColorId(
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Zgjidh ngjyrën
                    </option>

                    {colors.map((color)=>(
                      <option
                        key={color.id}
                        value={color.id}
                      >
                        {color.name}
                      </option>
                    ))}
                  </select>

                </label>

              </div>


              <label className="works-field works-description-field">

                <span>Përshkrimi i punës</span>

                <textarea
                  value={description}
                  onChange={(event)=>
                    setDescription(
                      event.target.value
                    )
                  }
                  placeholder="P.sh. Urë zirkoni, kontroll i kontaktit dhe ngjyrës..."
                  maxLength={2000}
                  rows={4}
                />

                <small>
                  {description.length}/2000
                </small>

              </label>


              <label className="works-repeat-toggle">

                <input
                  type="checkbox"
                  checked={isRepeat}
                  onChange={(event)=>
                    setIsRepeat(
                      event.target.checked
                    )
                  }
                />

                <span className="works-repeat-switch">
                  <span />
                </span>

                <span className="works-repeat-copy">
                  <strong>Punë e përsëritur</strong>
                  <small>
                    Aktivizojeni nëse kjo punë është përsëritje.
                  </small>
                </span>

              </label>


              <div className="works-pricing-block">

                <span className="works-pricing-label">
                  Mënyra e çmimit
                </span>

                <div className="works-pricing-options">

                  <button
                    type="button"
                    className={
                      pricingMode === "per_tooth"
                        ? "is-active"
                        : ""
                    }
                    onClick={()=>
                      setPricingMode("per_tooth")
                    }
                  >
                    Për dhëmb
                  </button>

                  <button
                    type="button"
                    className={
                      pricingMode === "fixed_total"
                        ? "is-active"
                        : ""
                    }
                    onClick={()=>
                      setPricingMode("fixed_total")
                    }
                  >
                    Çmim total
                  </button>

                </div>

              </div>


              <label className="works-field">

                <span>
                  {
                    pricingMode === "fixed_total"
                      ? "Çmimi total"
                      : "Çmimi / dhëmb"
                  }
                </span>

                <div className="works-price-input">
                  <span>€</span>

                  <input
                    type="number"
                    min={isRepeat ? "0" : "0.01"}
                    step="0.01"
                    value={price}
                    onChange={(event)=>
                      setPrice(
                        event.target.value
                      )
                    }
                    placeholder="0.00"
                    required
                  />
                </div>

              </label>

            </div>


            <div className="works-odontogram">

              <div className="works-odontogram-header">

                <div>
                  <span className="works-odontogram-eyebrow">
                    Odontograma
                  </span>

                  <h3>Zgjidh dhëmbët</h3>
                </div>

                <div className="works-odontogram-actions">

                  <button
                    type="button"
                    className="works-select-all-teeth"
                    onClick={selectAllTeeth}
                    disabled={
                      selectedTeeth.length ===
                      allTeeth.length
                    }
                  >
                    Zgjidh të gjithë
                  </button>

                  <span className="works-selection-count">
                    {selectedTeeth.length} të zgjedhur
                  </span>

                </div>

              </div>


              <div className="works-dental-map">

                <div className="works-cross-horizontal" />
                <div className="works-cross-vertical" />

                <div className="works-center-tooth">
                  🦷
                </div>

                {renderQuadrant(
                  "Sipër majtas",
                  upperLeft,
                  selectedTeeth,
                  toggleTooth,
                  "is-upper-left"
                )}

                {renderQuadrant(
                  "Sipër djathtas",
                  upperRight,
                  selectedTeeth,
                  toggleTooth,
                  "is-upper-right"
                )}

                {renderQuadrant(
                  "Poshtë majtas",
                  lowerLeft,
                  selectedTeeth,
                  toggleTooth,
                  "is-lower-left"
                )}

                {renderQuadrant(
                  "Poshtë djathtas",
                  lowerRight,
                  selectedTeeth,
                  toggleTooth,
                  "is-lower-right"
                )}

              </div>


              <div className="works-legend">

                <span className="works-legend-item">
                  <span className="works-legend-box" />
                  Pa zgjedhur
                </span>

                <span className="works-legend-item">
                  <span className="works-legend-box is-normal" />
                  Normal
                </span>

                <span className="works-legend-item">
                  <span
                    className="works-legend-box is-antar"
                    aria-hidden="true"
                  />
                  Antar
                </span>

                <span className="works-legend-help">
                  Klikimi i parë: normal · Klikimi i
                  dytë: Antar · Klikimi i tretë: hiq
                </span>

              </div>

            </div>


            <aside className="works-summary">

              <div className="works-summary-header">

                <span className="works-summary-icon">
                  ✓
                </span>

                <h3>Përmbledhje</h3>

              </div>


              <div className="works-summary-row">

                <div>
                  <span className="works-summary-dot is-blue">
                    🦷
                  </span>

                  <span>Dhëmbë të zgjedhur</span>
                </div>

                <strong className="is-blue">
                  {selectedTeeth.length}
                </strong>

              </div>


              <div className="works-summary-row">

                <div>
                  <span
                    className="works-summary-dot is-red"
                    aria-hidden="true"
                  />

                  <span>Dhëmbë Antar</span>
                </div>

                <strong className="is-red">
                  {selectedAntarCount}
                </strong>

              </div>


              <div className="works-summary-row is-total">

                <div>
                  <span className="works-summary-dot is-green">
                    €
                  </span>

                  <span>Totali i çmimit</span>
                </div>

                <strong className="is-green">
                  {totalAmount.toFixed(2)} €
                </strong>

              </div>


              {
                formMessage &&
                formMessageType === "success" && (

                  <AppToast
                    message={formMessage}
                    type="success"
                    onClose={()=>{

                      setFormMessage("");
                      setFormMessageType("");

                    }}
                  />

                )
              }


              {
                formMessage &&
                formMessageType === "error" && (

                  <div
                    className="works-message is-error"
                    role="alert"
                  >
                    {formMessage}
                  </div>

                )
              }


              <button
                type="submit"
                className="works-submit-button"
                disabled={isSubmitting}
              >
                <span>＋</span>

                {
                  isSubmitting
                    ? "Duke u shtuar..."
                    : "Shto punën"
                }
              </button>

            </aside>

          </form>

        </section>


          </div>

        )}


        <section className="works-history-card">

          <div className="works-history-header">

            <div className="works-section-title">

              <span className="works-section-icon is-light">
                ▣
              </span>

              <div>
                <h2>Historiku i punëve</h2>
                <p>
                  {filteredWorks.length} nga{" "}
                  {works.length} punë
                </p>
              </div>

            </div>


            <button
              type="button"
              className="works-refresh-button"
              onClick={loadData}
              disabled={isLoading}
            >
              ↻ Rifresko
            </button>

          </div>


          {historyMessage && (

            <AppToast
              message={historyMessage}
              type={
                historyMessageType === "success"
                  ? "success"
                  : "error"
              }
              onClose={()=>{

                setHistoryMessage("");
                setHistoryMessageType("");

              }}
            />

          )}


          <div className="works-filters">

            <div className="works-search">

              <span>⌕</span>

              <input
                type="search"
                value={search}
                onChange={(event)=>
                  setSearch(event.target.value)
                }
                placeholder="Kërko sipas pacientit, mjekut, materialit..."
              />

            </div>


            <select
              value={statusFilter}
              onChange={(event)=>
                setStatusFilter(
                  event.target.value
                )
              }
            >
              <option value="all">
                Të gjitha statuset
              </option>

              <option value="active">
                Aktive
              </option>

              <option value="cancelled">
                Anuluar
              </option>
            </select>

          </div>


          <div className="works-modern-list">

            {filteredWorks.map((work)=>(

              <article
                key={work.id}
                className={
                  work.status === "cancelled"
                    ? "works-modern-row is-cancelled"
                    : "works-modern-row"
                }
              >

                <button
                  type="button"
                  className="works-modern-main"
                  onClick={()=>
                    setSelectedWork(work)
                  }
                >

                  <span className="works-modern-number">

                    <strong>
                      {getWorkNumber(work)}
                    </strong>

                    <small>
                      {formatDate(work.work_date)}
                    </small>

                  </span>


                  <span className="works-modern-patient">

                    <strong>
                      {work.first_name}{" "}
                      {work.last_name}
                    </strong>

                    <small>
                      {work.doctor_name}
                    </small>

                    <small
                      className="works-modern-description"
                      title={
                        work.description ??
                        "Pa përshkrim"
                      }
                    >
                      {
                        work.description?.trim()
                          ? work.description
                          : "Pa përshkrim"
                      }
                    </small>

                  </span>


                  <span className="works-modern-reference">

                    <small>Materiali</small>

                    <strong>
                      {work.material_name ?? "-"}
                    </strong>

                    <span>
                      {work.color_name ?? "-"}
                    </span>

                  </span>


                  <span className="works-modern-teeth">

                    <small>Dhëmbët</small>

                    <span>

                      {work.teeth
                        .slice(0,5)
                        .map((tooth)=>(

                          <i
                            key={tooth.number}
                            className={
                              tooth.is_antar
                                ? "is-antar"
                                : ""
                            }
                          >
                            {tooth.number}
                          </i>

                        ))}

                      {work.teeth.length > 5 && (
                        <b>
                          +{work.teeth.length - 5}
                        </b>
                      )}

                    </span>

                  </span>


                  <span className="works-modern-type">

                    <small>Lloji</small>

                    <strong
                      className={
                        work.is_repeat
                          ? "is-repeat"
                          : "is-new"
                      }
                    >
                      {
                        work.is_repeat
                          ? "Përsëritje"
                          : "E re"
                      }
                    </strong>

                  </span>


                  <span className="works-modern-total">

                    <small>Totali</small>

                    <strong>
                      {
                        Number(
                          work.total_amount,
                        ).toFixed(2)
                      } €
                    </strong>

                  </span>


                  <span
                    className={
                      work.status === "cancelled"
                        ? "works-modern-status is-cancelled"
                        : "works-modern-status is-active"
                    }
                  >
                    {
                      work.status === "cancelled"
                        ? "Anuluar"
                        : "Aktive"
                    }
                  </span>


                  <span
                    className="works-modern-arrow"
                    aria-hidden="true"
                  >
                    ›
                  </span>

                </button>


                <div className="works-modern-actions">

                  <button
                    type="button"
                    className="works-view-button"
                    onClick={()=>
                      setSelectedWork(work)
                    }
                  >
                    Shiko
                  </button>


                  <button
                    type="button"
                    className={
                      work.status === "cancelled"
                        ? "works-status-button is-reactivate"
                        : "works-status-button is-cancel"
                    }
                    disabled={
                      actionWorkId === work.id
                    }
                    onClick={()=>
                      updateWorkStatus(work)
                    }
                  >
                    {
                      actionWorkId === work.id
                        ? "..."
                        : work.status === "cancelled"
                          ? "Riaktivizo"
                          : "Anulo"
                    }
                  </button>

                </div>

              </article>

            ))}


            {!isLoading &&
              filteredWorks.length === 0 && (

                <div className="works-modern-empty">

                  <strong>
                    Nuk u gjet asnjë punë
                  </strong>

                  <span>
                    Ndryshoni kërkimin ose filtrin.
                  </span>

                </div>

              )}


            {isLoading && (

              <div className="works-modern-empty">
                Duke ngarkuar...
              </div>

            )}

          </div>

        </section>


        {selectedWork && (

          <div
            className="works-modal-backdrop"
            onMouseDown={(event)=>{
              if(
                event.target ===
                event.currentTarget
              ){
                setSelectedWork(null);
              }
            }}
          >

            <div
              className="works-modal"
              role="dialog"
              aria-modal="true"
            >

              <header className="works-modal-header">

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


              <div className="works-detail-grid">

                <div>
                  <span>Data</span>
                  <strong>
                    {
                      formatDate(
                        selectedWork.work_date
                      )
                    }
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

                <div>
                  <span>Pacienti</span>
                  <strong>
                    {selectedWork.first_name}{" "}
                    {selectedWork.last_name}
                  </strong>
                </div>

                <div>
                  <span>Mjeku</span>
                  <strong>
                    {selectedWork.doctor_name}
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
                      Number(
                        selectedWork.pricing_mode ===
                        "fixed_total"
                          ? selectedWork.total_amount
                          : selectedWork.price_per_tooth
                      ).toFixed(2)
                    } €
                  </strong>
                </div>

                <div>
                  <span>Totali</span>
                  <strong>
                    {
                      Number(
                        selectedWork.total_amount
                      ).toFixed(2)
                    } €
                  </strong>
                </div>

              </div>


              <section className="works-detail-description">

                <h3>Përshkrimi i punës</h3>

                <p>
                  {
                    selectedWork.description ??
                    "Pa përshkrim"
                  }
                </p>

              </section>


              <section className="works-detail-teeth-section">

                <div>
                  <h3>Dhëmbët</h3>

                  <span>
                    {selectedWork.teeth.length} gjithsej
                  </span>
                </div>

                <div className="works-detail-teeth">

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
                      </span>
                    )
                  )}

                </div>

              </section>


              <footer className="works-modal-footer">

                <button
                  type="button"
                  className="works-secondary-button"
                  onClick={()=>
                    setSelectedWork(null)
                  }
                >
                  Mbyll
                </button>

                <button
                  type="button"
                  className="works-primary-button"
                  onClick={()=>
                    openEditWork(selectedWork)
                  }
                >
                  Ndrysho
                </button>

              </footer>

            </div>

          </div>

        )}


        {editingWork && (

          <div
            className="works-modal-backdrop"
            onMouseDown={(event)=>{
              if(
                event.target ===
                event.currentTarget
              ){
                setEditingWork(null);
                setEditMessage("");
              }
            }}
          >

            <form
              className="works-modal works-edit-modal"
              onSubmit={submitEditWork}
            >

              <header className="works-modal-header">

                <div>
                  <span>Ndrysho punën</span>
                  <h2>
                    {getWorkNumber(editingWork)}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={()=>{
                    setEditingWork(null);
                    setEditMessage("");
                  }}
                >
                  ×
                </button>

              </header>


              <div className="works-edit-content">

                <div className="works-edit-fields">

                  <label className="works-field">
                    <span>Mjeku</span>

                    <select
                      value={editDoctorId}
                      onChange={(event)=>
                        setEditDoctorId(
                          event.target.value
                        )
                      }
                    >
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


                  <label className="works-field">
                    <span>Emri pacientit</span>

                    <input
                      value={editFirstName}
                      onChange={(event)=>
                        setEditFirstName(
                          event.target.value
                        )
                      }
                    />
                  </label>


                  <label className="works-field">
                    <span>Mbiemri pacientit</span>

                    <input
                      value={editLastName}
                      onChange={(event)=>
                        setEditLastName(
                          event.target.value
                        )
                      }
                    />
                  </label>


                  <label className="works-field">
                    <span>Materiali</span>

                    <select
                      value={editMaterialId}
                      onChange={(event)=>
                        setEditMaterialId(
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Pa material
                      </option>

                      {editMaterials.map((material)=>(
                        <option
                          key={material.id}
                          value={material.id}
                        >
                          {material.name}
                        </option>
                      ))}
                    </select>
                  </label>


                  <label className="works-field">
                    <span>Ngjyra</span>

                    <select
                      value={editColorId}
                      onChange={(event)=>
                        setEditColorId(
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Pa ngjyrë
                      </option>

                      {colors.map((color)=>(
                        <option
                          key={color.id}
                          value={color.id}
                        >
                          {color.name}
                        </option>
                      ))}
                    </select>
                  </label>


                  <label className="works-field works-edit-description-field">
                    <span>Përshkrimi i punës</span>

                    <textarea
                      value={editDescription}
                      onChange={(event)=>
                        setEditDescription(
                          event.target.value
                        )
                      }
                      maxLength={2000}
                      rows={4}
                      placeholder="Shtoni një përshkrim të punës..."
                    />

                    <small>
                      {editDescription.length}/2000
                    </small>
                  </label>


                  <label className="works-repeat-toggle works-edit-repeat-toggle">

                    <input
                      type="checkbox"
                      checked={editIsRepeat}
                      onChange={(event)=>
                        setEditIsRepeat(
                          event.target.checked
                        )
                      }
                    />

                    <span className="works-repeat-switch">
                      <span />
                    </span>

                    <span className="works-repeat-copy">
                      <strong>Punë e përsëritur</strong>
                      <small>
                        Aktivizojeni nëse puna është përsëritje.
                      </small>
                    </span>

                  </label>


                  <div className="works-pricing-block works-edit-pricing-block">

                    <span className="works-pricing-label">
                      Mënyra e çmimit
                    </span>

                    <div className="works-pricing-options">

                      <button
                        type="button"
                        className={
                          editPricingMode === "per_tooth"
                            ? "is-active"
                            : ""
                        }
                        onClick={()=>
                          setEditPricingMode(
                            "per_tooth"
                          )
                        }
                      >
                        Për dhëmb
                      </button>

                      <button
                        type="button"
                        className={
                          editPricingMode === "fixed_total"
                            ? "is-active"
                            : ""
                        }
                        onClick={()=>
                          setEditPricingMode(
                            "fixed_total"
                          )
                        }
                      >
                        Çmim total
                      </button>

                    </div>

                  </div>


                  <label className="works-field">
                    <span>
                      {
                        editPricingMode === "fixed_total"
                          ? "Çmimi total"
                          : "Çmimi / dhëmb"
                      }
                    </span>

                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={editPrice}
                      onChange={(event)=>
                        setEditPrice(
                          event.target.value
                        )
                      }
                    />
                  </label>

                </div>


                <div className="works-edit-odontogram">

                  <h3>Dhëmbët</h3>

                  <div className="works-dental-map">

                    <div className="works-cross-horizontal" />
                    <div className="works-cross-vertical" />

                    <div className="works-center-tooth">
                      🦷
                    </div>

                    {renderQuadrant(
                      "Sipër majtas",
                      upperLeft,
                      editTeeth,
                      toggleEditTooth,
                      "is-upper-left"
                    )}

                    {renderQuadrant(
                      "Sipër djathtas",
                      upperRight,
                      editTeeth,
                      toggleEditTooth,
                      "is-upper-right"
                    )}

                    {renderQuadrant(
                      "Poshtë majtas",
                      lowerLeft,
                      editTeeth,
                      toggleEditTooth,
                      "is-lower-left"
                    )}

                    {renderQuadrant(
                      "Poshtë djathtas",
                      lowerRight,
                      editTeeth,
                      toggleEditTooth,
                      "is-lower-right"
                    )}

                  </div>

                </div>


                <div className="works-edit-summary">

                  <span>
                    Dhëmbë:{" "}
                    <strong>{editTeeth.length}</strong>
                  </span>

                  <span>
                    Antar:{" "}
                    <strong>
                      {
                        editTeeth.filter(
                          (tooth)=>
                            tooth.is_antar
                        ).length
                      }
                    </strong>
                  </span>

                  <span>
                    Total:{" "}
                    <strong>
                      {
                        (
                          Number(editPrice || 0) *
                          editTeeth.length
                        ).toFixed(2)
                      } €
                    </strong>
                  </span>

                </div>


                {editMessage && (
                  <div className="works-message is-error">
                    {editMessage}
                  </div>
                )}

              </div>


              <footer className="works-modal-footer">

                <button
                  type="button"
                  className="works-secondary-button"
                  disabled={isEditing}
                  onClick={()=>{
                    setEditingWork(null);
                    setEditMessage("");
                  }}
                >
                  Anulo
                </button>

                <button
                  type="submit"
                  className="works-primary-button"
                  disabled={isEditing}
                >
                  {
                    isEditing
                      ? "Duke ruajtur..."
                      : "Ruaj ndryshimet"
                  }
                </button>

              </footer>

            </form>

          </div>

        )}

      </main>

    </Layout>

  );

}
