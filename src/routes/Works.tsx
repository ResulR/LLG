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


type Material = {
  id:string;
  name:string;
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


export default function Works(){

  const [doctors,setDoctors]=useState<Doctor[]>([]);
  const [materials,setMaterials]=useState<Material[]>([]);
  const [colors,setColors]=useState<Color[]>([]);
  const [works,setWorks]=useState<Work[]>([]);

  const [isLoading,setIsLoading]=useState(true);

  const [doctorId,setDoctorId]=useState("");
  const [firstName,setFirstName]=useState("");
  const [lastName,setLastName]=useState("");
  const [materialId,setMaterialId]=useState("");
  const [colorId,setColorId]=useState("");
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
  const [editPrice,setEditPrice]=useState("");
  const [editTeeth,setEditTeeth]=useState<
    ToothSelection[]
  >([]);
  const [editMessage,setEditMessage]=useState("");
  const [isEditing,setIsEditing]=useState(false);


  async function loadData(){

    setIsLoading(true);

    try{

      const [
        referencesResponse,
        worksResponse,
      ] = await Promise.all([
        api("/works/references"),
        api("/works"),
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

  },[]);


  useEffect(()=>{

    if(!selectedWork && !editingWork){
      return;
    }


    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";


    function handleKeyDown(event:KeyboardEvent){

      if(event.key !== "Escape"){
        return;
      }


      if(editingWork){

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

  },[selectedWork,editingWork]);


  const selectedAntarCount = useMemo(
    ()=>selectedTeeth.filter(
      (tooth)=>tooth.is_antar
    ).length,
    [selectedTeeth]
  );


  const totalAmount = useMemo(
    ()=>Number(price || 0) * selectedTeeth.length,
    [price,selectedTeeth]
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


  function toggleTooth(toothNumber:number){

    setSelectedTeeth((current)=>
      cycleTooth(current,toothNumber)
    );

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

        {tooth?.is_antar && (
          <span
            className="works-tooth-x"
            aria-hidden="true"
          >
            ×
          </span>
        )}
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

    const numericPrice =
      Number(price);


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


    if(selectedTeeth.length === 0){

      setFormMessage(
        "Zgjidhni të paktën një dhëmb."
      );
      setFormMessageType("error");
      return;

    }


    if(
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0
    ){

      setFormMessage(
        "Çmimi për dhëmb duhet të jetë më i madh se 0."
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
            patient_first_name:cleanFirstName,
            patient_last_name:cleanLastName,
            material_id:materialId
              ? Number(materialId)
              : null,
            color_id:colorId
              ? Number(colorId)
              : null,
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

        }catch{
          // Garder le message par défaut.
        }


        setFormMessage(message);
        setFormMessageType("error");
        return;

      }


      setDoctorId("");
      setFirstName("");
      setLastName("");
      setMaterialId("");
      setColorId("");
      setPrice("");
      setSelectedTeeth([]);

      setFormMessage(
        "Puna u shtua me sukses."
      );
      setFormMessageType("success");

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


    if(!window.confirm(confirmationMessage)){
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

    setEditPrice(
      String(work.price_per_tooth)
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


    if(editTeeth.length === 0){

      setEditMessage(
        "Zgjidhni të paktën një dhëmb."
      );
      return;

    }


    if(
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0
    ){

      setEditMessage(
        "Çmimi nuk është valid."
      );
      return;

    }


    if(
      !window.confirm(
        `A dëshironi t'i ruani ndryshimet për punën ${getWorkNumber(editingWork)}?`
      )
    ){
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


        <section className="works-create-card">

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


              <label className="works-field">

                <span>Çmimi / dhëmb</span>

                <div className="works-price-input">
                  <span>€</span>

                  <input
                    type="number"
                    min="0.01"
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

                <span className="works-selection-count">
                  {selectedTeeth.length} të zgjedhur
                </span>

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
                  <span className="works-legend-box is-antar">
                    ×
                  </span>
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
                  <span className="works-summary-dot is-red">
                    ×
                  </span>

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


              {formMessage && (
                <div
                  className={
                    formMessageType === "success"
                      ? "works-message is-success"
                      : "works-message is-error"
                  }
                  role="alert"
                >
                  {formMessage}
                </div>
              )}


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
            <div
              className={
                historyMessageType === "success"
                  ? "works-message is-success"
                  : "works-message is-error"
              }
              role="alert"
            >
              {historyMessage}
            </div>
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


          <div className="works-table-scroll">

            <table className="works-table">

              <thead>

                <tr>
                  <th>Nr</th>
                  <th>Pacienti</th>
                  <th>Mjeku</th>
                  <th>Material</th>
                  <th>Ngjyra</th>
                  <th>Dhëmbët</th>
                  <th>Statusi</th>
                  <th>Total</th>
                  <th>Veprime</th>
                </tr>

              </thead>


              <tbody>

                {filteredWorks.map((work)=>(

                  <tr key={work.id}>

                    <td>
                      <strong>
                        {getWorkNumber(work)}
                      </strong>
                    </td>

                    <td>
                      <div className="works-patient-cell">
                        <strong>
                          {work.first_name}{" "}
                          {work.last_name}
                        </strong>

                        <span>
                          {formatDate(work.work_date)}
                        </span>
                      </div>
                    </td>

                    <td>{work.doctor_name}</td>

                    <td>
                      {work.material_name ?? "-"}
                    </td>

                    <td>
                      {work.color_name ?? "-"}
                    </td>

                    <td>
                      <div className="works-table-teeth">

                        {work.teeth
                          .slice(0,6)
                          .map((tooth)=>(
                            <span
                              key={tooth.number}
                              className={
                                tooth.is_antar
                                  ? "is-antar"
                                  : ""
                              }
                            >
                              {tooth.number}
                              {
                                tooth.is_antar
                                  ? "×"
                                  : ""
                              }
                            </span>
                          ))}

                        {work.teeth.length > 6 && (
                          <strong>
                            +{work.teeth.length - 6}
                          </strong>
                        )}

                      </div>
                    </td>

                    <td>
                      <span
                        className={
                          work.status === "cancelled"
                            ? "works-status is-cancelled"
                            : "works-status is-active"
                        }
                      >
                        {
                          work.status === "cancelled"
                            ? "Anuluar"
                            : "Aktive"
                        }
                      </span>
                    </td>

                    <td>
                      <strong>
                        {
                          Number(
                            work.total_amount
                          ).toFixed(2)
                        } €
                      </strong>
                    </td>

                    <td>
                      <div className="works-actions">

                        <button
                          type="button"
                          className="works-view-button"
                          onClick={()=>
                            setSelectedWork(work)
                          }
                        >
                          ◉ Shiko
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
                    </td>

                  </tr>

                ))}


                {!isLoading &&
                  filteredWorks.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="works-empty"
                      >
                        Nuk u gjet asnjë punë.
                      </td>
                    </tr>
                  )}


                {isLoading && (
                  <tr>
                    <td
                      colSpan={9}
                      className="works-empty"
                    >
                      Duke ngarkuar...
                    </td>
                  </tr>
                )}

              </tbody>

            </table>

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
                  <span>Çmimi / dhëmb</span>
                  <strong>
                    {
                      Number(
                        selectedWork.price_per_tooth
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

                        {tooth.is_antar && (
                          <strong>×</strong>
                        )}
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


                  <label className="works-field">
                    <span>Çmimi / dhëmb</span>

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
