import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Boxes,
  ChevronRight,
  Palette,
  Pencil,
  Search,
  Stethoscope,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import Layout from "@/components/Layout";
import AppToast from "@/components/AppToast";
import MaterialsManager from "@/components/MaterialsManager";
import ColorsManager from "@/components/ColorsManager";
import { api } from "@/lib/api";
import { useUnsavedChanges } from "@/lib/useUnsavedChanges";
import { useConfirm } from "@/context/ConfirmContext";


type Doctor = {
  id:number;
  name:string;
  phone:string|null;
  active:boolean;
  created_at:string;
};


type MessageType =
  "success"|"error"|"";


type DoctorsTab =
  "doctors" |
  "materials" |
  "colors";


export default function Doctors() {

  const navigate = useNavigate();

  const {
    confirmAction,
  } = useConfirm();

  const [doctors,setDoctors] =
    useState<Doctor[]>([]);

  const [name,setName] =
    useState("");

  const [phone,setPhone] =
    useState("");

  const [editingId,setEditingId] =
    useState<number|null>(null);

  const [search,setSearch] =
    useState("");

  const [statusFilter,setStatusFilter] =
    useState("all");

  const [loading,setLoading] =
    useState(true);

  const [saving,setSaving] =
    useState(false);

  const [actionDoctorId,setActionDoctorId] =
    useState<number|null>(null);

  const [message,setMessage] =
    useState("");

  const [messageType,setMessageType] =
    useState<MessageType>("");

  const [activeTab,setActiveTab] =
    useState<DoctorsTab>(
      "doctors",
    );


  const doctorFormIsDirty =
    useMemo(
      ()=>{

        if(editingId === null) {

          return Boolean(
            name.trim() ||
            phone.trim(),
          );

        }


        const originalDoctor =
          doctors.find(
            (doctor)=>
              doctor.id === editingId,
          );


        if(!originalDoctor) {
          return false;
        }


        return (
          name !== originalDoctor.name ||
          phone !== (
            originalDoctor.phone ?? ""
          )
        );

      },
      [
        doctors,
        editingId,
        name,
        phone,
      ],
    );


  useUnsavedChanges(
    "doctors-form",
    doctorFormIsDirty,
  );


  async function loadDoctors() {

    setLoading(true);


    try {

      const response =
        await api("/doctors");


      if(!response.ok) {

        throw new Error(
          "doctors_load_failed",
        );

      }


      setDoctors(
        await response.json(),
      );


    } catch(error) {

      console.error(error);

      setMessage(
        "Mjekët nuk mund të ngarkoheshin.",
      );

      setMessageType("error");


    } finally {

      setLoading(false);

    }

  }


  useEffect(()=>{

    loadDoctors();

  },[]);


  const activeDoctorsCount =
    useMemo(
      ()=>doctors.filter(
        (doctor)=>doctor.active,
      ).length,
      [doctors],
    );


  const inactiveDoctorsCount =
    doctors.length - activeDoctorsCount;


  const filteredDoctors =
    useMemo(()=>{

      const normalizedSearch =
        search.trim().toLowerCase();


      return doctors.filter(
        (doctor)=>{

          const matchesSearch = [
            doctor.name,
            doctor.phone ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch);


          const matchesStatus =
            statusFilter === "all" ||
            (
              statusFilter === "active" &&
              doctor.active
            ) ||
            (
              statusFilter === "inactive" &&
              !doctor.active
            );


          return (
            matchesSearch &&
            matchesStatus
          );

        },
      );

    },[
      doctors,
      search,
      statusFilter,
    ]);


  function resetForm() {

    setName("");
    setPhone("");
    setEditingId(null);

  }


  async function saveDoctor(
    event:React.FormEvent,
  ) {

    event.preventDefault();

    setMessage("");
    setMessageType("");


    const cleanName =
      name.trim();

    const cleanPhone =
      phone.trim();


    if(!cleanName) {

      setMessage(
        "Shkruani emrin e mjekut.",
      );

      setMessageType("error");

      return;

    }


    setSaving(true);


    try {

      const response = await api(
        editingId
          ? `/doctors/${editingId}`
          : "/doctors",
        {
          method:
            editingId
              ? "PUT"
              : "POST",

          body:JSON.stringify({
            name:cleanName,
            phone:cleanPhone,
          }),
        },
      );


      if(!response.ok) {

        throw new Error(
          "doctor_save_failed",
        );

      }


      const wasEditing =
        editingId !== null;

      resetForm();

      setMessage(
        wasEditing
          ? "Ndryshimet u ruajtën me sukses."
          : "Mjeku u shtua me sukses.",
      );

      setMessageType("success");

      await loadDoctors();


    } catch(error) {

      console.error(error);

      setMessage(
        editingId
          ? "Ndryshimet nuk mund të ruheshin."
          : "Mjeku nuk mund të shtohej.",
      );

      setMessageType("error");


    } finally {

      setSaving(false);

    }

  }


  function editDoctor(
    doctor:Doctor,
  ) {

    setEditingId(doctor.id);
    setName(doctor.name);
    setPhone(doctor.phone ?? "");

    setMessage("");
    setMessageType("");

    window.scrollTo({
      top:0,
      behavior:"smooth",
    });

  }


  async function toggleStatus(
    doctor:Doctor,
  ) {

    const nextStatus =
      !doctor.active;

    const confirmed =
      await confirmAction({
        title:
          nextStatus
            ? "Aktivizo mjekun"
            : "Çaktivizo mjekun",

        message:
          nextStatus
            ? `A dëshironi ta aktivizoni mjekun ${doctor.name}?`
            : `A dëshironi ta çaktivizoni mjekun ${doctor.name}?`,

        confirmLabel:
          nextStatus
            ? "Aktivizo"
            : "Çaktivizo",

        tone:
          nextStatus
            ? "primary"
            : "warning",
      });


    if(!confirmed) {
      return;
    }


    setActionDoctorId(doctor.id);
    setMessage("");
    setMessageType("");


    try {

      const response = await api(
        `/doctors/${doctor.id}/status`,
        {
          method:"PATCH",

          body:JSON.stringify({
            active:nextStatus,
          }),
        },
      );


      if(!response.ok) {

        throw new Error(
          "doctor_status_failed",
        );

      }


      setDoctors(
        (current)=>
          current.map(
            (item)=>
              item.id === doctor.id
                ? {
                    ...item,
                    active:nextStatus,
                  }
                : item,
          ),
      );


      setMessage(
        nextStatus
          ? "Mjeku u aktivizua."
          : "Mjeku u çaktivizua.",
      );

      setMessageType("success");


    } catch(error) {

      console.error(error);

      setMessage(
        "Statusi i mjekut nuk mund të ndryshohej.",
      );

      setMessageType("error");


    } finally {

      setActionDoctorId(null);

    }

  }


  return (

    <Layout>

      <main className="doctors-page">

        <header className="doctors-page-header">

          <div>

            <span className="doctors-eyebrow">
              Menaxhimi i laboratorit
            </span>

            <h1>Mjekët</h1>

            <p>
              Shtoni, kërkoni dhe menaxhoni
              mjekët e laboratorit.
            </p>

          </div>

        </header>


        <nav
          className="doctors-module-tabs"
          role="tablist"
          aria-label="Seksionet e menaxhimit"
        >

          <button
            id="doctors-tab-doctors"
            type="button"
            role="tab"
            aria-controls="doctors-panel-doctors"
            className={
              activeTab === "doctors"
                ? "is-active"
                : ""
            }
            onClick={()=>
              setActiveTab("doctors")
            }
            aria-selected={
              activeTab === "doctors"
            }
          >
            <Stethoscope size={18} />

            <span>Mjekët</span>
          </button>


          <button
            id="doctors-tab-materials"
            type="button"
            role="tab"
            aria-controls="doctors-panel-materials"
            className={
              activeTab === "materials"
                ? "is-active"
                : ""
            }
            onClick={()=>
              setActiveTab("materials")
            }
            aria-selected={
              activeTab === "materials"
            }
          >
            <Boxes size={18} />

            <span>Materialet</span>
          </button>


          <button
            id="doctors-tab-colors"
            type="button"
            role="tab"
            aria-controls="doctors-panel-colors"
            className={
              activeTab === "colors"
                ? "is-active"
                : ""
            }
            onClick={()=>
              setActiveTab("colors")
            }
            aria-selected={
              activeTab === "colors"
            }
          >
            <Palette size={18} />

            <span>Ngjyrat</span>
          </button>

        </nav>


        <section
          id="doctors-panel-doctors"
          className="doctors-tab-panel"
          role="tabpanel"
          aria-labelledby="doctors-tab-doctors"
          hidden={
            activeTab !== "doctors"
          }
        >

        <section className="doctors-kpi-grid">

          <article>

            <span className="doctors-kpi-icon is-total">
              <Stethoscope size={21} />
            </span>

            <div>
              <span>Gjithsej</span>

              <strong>
                {doctors.length}
              </strong>

              <small>Mjekë të regjistruar</small>
            </div>

          </article>


          <article>

            <span className="doctors-kpi-icon is-active">
              <UserCheck size={21} />
            </span>

            <div>
              <span>Aktivë</span>

              <strong>
                {activeDoctorsCount}
              </strong>

              <small>Mund të marrin punë</small>
            </div>

          </article>


          <article>

            <span className="doctors-kpi-icon is-inactive">
              <UserX size={21} />
            </span>

            <div>
              <span>Jo aktivë</span>

              <strong>
                {inactiveDoctorsCount}
              </strong>

              <small>Të çaktivizuar</small>
            </div>

          </article>

        </section>


        <section className="doctors-main-grid">

          <article className="doctors-form-card">

            <div className="doctors-section-title">

              <span>
                {
                  editingId
                    ? <Pencil size={20} />
                    : <UserPlus size={20} />
                }
              </span>

              <div>

                <h2>
                  {
                    editingId
                      ? "Ndrysho mjekun"
                      : "Shto mjek"
                  }
                </h2>

                <p>
                  {
                    editingId
                      ? "Përditësoni të dhënat e mjekut."
                      : "Regjistroni një mjek të ri."
                  }
                </p>

              </div>

            </div>


            <form
              className="doctors-form"
              onSubmit={saveDoctor}
            >

              <label>

                <span>Emri i mjekut</span>

                <input
                  type="text"
                  value={name}
                  onChange={(event)=>
                    setName(
                      event.target.value,
                    )
                  }
                  placeholder="P.sh. Dr. Arben Krasniqi"
                  disabled={saving}
                  required
                />

              </label>


              <label>

                <span>Telefoni</span>

                <input
                  type="tel"
                  value={phone}
                  onChange={(event)=>
                    setPhone(
                      event.target.value,
                    )
                  }
                  placeholder="P.sh. 044 123 456"
                  disabled={saving}
                />

              </label>


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


              <div className="doctors-form-actions">

                {editingId && (

                  <button
                    type="button"
                    className="doctors-cancel-button"
                    onClick={resetForm}
                    disabled={saving}
                  >
                    Anulo
                  </button>

                )}


                <button
                  type="submit"
                  className="doctors-save-button"
                  disabled={saving}
                >
                  {
                    saving
                      ? "Duke ruajtur..."
                      : editingId
                        ? "Ruaj ndryshimet"
                        : "Shto mjekun"
                  }
                </button>

              </div>

            </form>

          </article>


          <article className="doctors-list-card">

            <div className="doctors-list-header">

              <div className="doctors-section-title">

                <span>
                  <Stethoscope size={20} />
                </span>

                <div>
                  <h2>Lista e mjekëve</h2>

                  <p>
                    {
                      filteredDoctors.length
                    } nga{" "}
                    {
                      doctors.length
                    } mjekë
                  </p>
                </div>

              </div>


              <button
                type="button"
                className="doctors-refresh-button"
                onClick={loadDoctors}
                disabled={loading}
              >
                ↻ Rifresko
              </button>

            </div>


            <div className="doctors-filters">

              <div className="doctors-search">

                <Search
                  size={18}
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
                  placeholder="Kërko emrin ose telefonin..."
                />

              </div>


              <select
                value={statusFilter}
                onChange={(event)=>
                  setStatusFilter(
                    event.target.value,
                  )
                }
              >
                <option value="all">
                  Të gjitha statuset
                </option>

                <option value="active">
                  Aktivë
                </option>

                <option value="inactive">
                  Jo aktivë
                </option>
              </select>

            </div>


            <div className="doctors-table-scroll">

              <table className="doctors-table">

                <thead>

                  <tr>
                    <th>Mjeku</th>
                    <th>Telefoni</th>
                    <th>Statusi</th>
                    <th>Veprime</th>
                    <th />
                  </tr>

                </thead>


                <tbody>

                  {filteredDoctors.map(
                    (doctor)=>(

                      <tr
                        key={doctor.id}
                        className="doctors-clickable-row"
                        tabIndex={0}
                        role="button"
                        aria-label={
                          `Hap detajet e mjekut ${doctor.name}`
                        }
                        onClick={()=>
                          navigate(
                            `/doctors/${doctor.id}`,
                          )
                        }
                        onKeyDown={(event)=>{

                          if(
                            event.key === "Enter" ||
                            event.key === " "
                          ) {

                            event.preventDefault();

                            navigate(
                              `/doctors/${doctor.id}`,
                            );

                          }

                        }}
                      >

                        <td>

                          <div className="doctors-doctor-cell">

                            <span>
                              {
                                doctor.name
                                  .charAt(0)
                                  .toUpperCase()
                              }
                            </span>

                            <div>
                              <strong>
                                {doctor.name}
                              </strong>

                              <small>
                                Mjeku #{doctor.id}
                              </small>
                            </div>

                          </div>

                        </td>


                        <td>
                          {doctor.phone ?? "-"}
                        </td>


                        <td>

                          <span
                            className={
                              doctor.active
                                ? "doctors-status is-active"
                                : "doctors-status is-inactive"
                            }
                          >
                            {
                              doctor.active
                                ? "Aktiv"
                                : "Jo aktiv"
                            }
                          </span>

                        </td>


                        <td>

                          <div
                            className="doctors-row-actions"
                            onClick={(event)=>
                              event.stopPropagation()
                            }
                          >

                            <button
                              type="button"
                              className="doctors-edit-button"
                              onClick={()=>
                                editDoctor(doctor)
                              }
                            >
                              <Pencil size={14} />
                              Ndrysho
                            </button>


                            <button
                              type="button"
                              className={
                                doctor.active
                                  ? "doctors-status-button is-deactivate"
                                  : "doctors-status-button is-activate"
                              }
                              disabled={
                                actionDoctorId ===
                                doctor.id
                              }
                              onClick={()=>
                                toggleStatus(doctor)
                              }
                            >
                              {
                                actionDoctorId ===
                                doctor.id
                                  ? "..."
                                  : doctor.active
                                    ? "Çaktivizo"
                                    : "Aktivizo"
                              }
                            </button>

                          </div>

                        </td>


                        <td className="doctors-chevron">

                          <ChevronRight
                            size={18}
                            aria-hidden="true"
                          />

                        </td>

                      </tr>

                    ),
                  )}


                  {!loading &&
                    filteredDoctors.length === 0 && (

                      <tr>

                        <td
                          colSpan={5}
                          className="doctors-empty"
                        >
                          Nuk u gjet asnjë mjek.
                        </td>

                      </tr>

                    )}


                  {loading && (

                    <tr>

                      <td
                        colSpan={5}
                        className="doctors-empty"
                      >
                        Duke ngarkuar...
                      </td>

                    </tr>

                  )}

                </tbody>

              </table>

            </div>

          </article>

        </section>

        </section>


        <section
          id="doctors-panel-materials"
          className="doctors-tab-panel"
          role="tabpanel"
          aria-labelledby="doctors-tab-materials"
          hidden={
            activeTab !== "materials"
          }
        >
          <MaterialsManager />
        </section>


        <section
          id="doctors-panel-colors"
          className="doctors-tab-panel"
          role="tabpanel"
          aria-labelledby="doctors-tab-colors"
          hidden={
            activeTab !== "colors"
          }
        >
          <ColorsManager />
        </section>

      </main>

    </Layout>

  );

}
