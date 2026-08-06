import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Boxes,
  ChevronRight,
  CircleDollarSign,
  Palette,
  Pencil,
  Plus,
  Search,
  Stethoscope,
  UserCheck,
  UserX,
  X,
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
  total_billed:string;
  total_paid:string;
  outstanding_balance:string;
  active_work_count:number;
  total_work_count:number;
  unpaid_work_count:number;
};


type MessageType =
  "success" |
  "error" |
  "";


type CatalogTab =
  "materials" |
  "colors";


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


function getInitials(
  value:string,
) {

  const parts =
    value
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


export default function Doctors() {

  const navigate =
    useNavigate();

  const {
    confirmAction,
  } =
    useConfirm();

  const [
    doctors,
    setDoctors,
  ] =
    useState<Doctor[]>([]);

  const [
    name,
    setName,
  ] =
    useState("");

  const [
    phone,
    setPhone,
  ] =
    useState("");

  const [
    editingId,
    setEditingId,
  ] =
    useState<number|null>(
      null,
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState("all");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    actionDoctorId,
    setActionDoctorId,
  ] =
    useState<number|null>(
      null,
    );

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    messageType,
    setMessageType,
  ] =
    useState<MessageType>("");

  const [
    formOpen,
    setFormOpen,
  ] =
    useState(false);

  const [
    catalogOpen,
    setCatalogOpen,
  ] =
    useState(false);

  const [
    catalogTab,
    setCatalogTab,
  ] =
    useState<CatalogTab>(
      "materials",
    );


  const doctorFormIsDirty =
    useMemo(
      ()=>{

        if(!formOpen) {
          return false;
        }


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
        formOpen,
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
        await api(
          "/doctors",
        );


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


  useEffect(
    ()=>{

      void loadDoctors();

    },
    [],
  );


  const activeDoctorsCount =
    useMemo(
      ()=>doctors.filter(
        (doctor)=>
          doctor.active,
      ).length,
      [
        doctors,
      ],
    );


  const inactiveDoctorsCount =
    doctors.length -
    activeDoctorsCount;


  const totalOutstanding =
    useMemo(
      ()=>doctors.reduce(
        (
          total,
          doctor,
        )=>
          total +
          Number(
            doctor.outstanding_balance ||
            0,
          ),
        0,
      ),
      [
        doctors,
      ],
    );


  const filteredDoctors =
    useMemo(
      ()=>{

        const normalizedSearch =
          search
            .trim()
            .toLowerCase();


        return doctors.filter(
          (doctor)=>{

            const matchesSearch = [
              doctor.name,
              doctor.phone ?? "",
            ]
              .join(" ")
              .toLowerCase()
              .includes(
                normalizedSearch,
              );


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

      },
      [
        doctors,
        search,
        statusFilter,
      ],
    );


  function resetForm() {

    setName("");
    setPhone("");
    setEditingId(null);

  }


  function closeForm() {

    if(saving) {
      return;
    }

    resetForm();
    setFormOpen(false);

  }


  function createDoctor() {

    resetForm();

    setMessage("");
    setMessageType("");

    setFormOpen(true);

  }


  function editDoctor(
    doctor:Doctor,
  ) {

    setEditingId(
      doctor.id,
    );

    setName(
      doctor.name,
    );

    setPhone(
      doctor.phone ?? "",
    );

    setMessage("");
    setMessageType("");

    setFormOpen(true);

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

      const response =
        await api(
          editingId === null
            ? "/doctors"
            : `/doctors/${editingId}`,
          {
            method:
              editingId === null
                ? "POST"
                : "PUT",

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
      setFormOpen(false);

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
        editingId === null
          ? "Mjeku nuk mund të shtohej."
          : "Ndryshimet nuk mund të ruheshin.",
      );

      setMessageType("error");


    } finally {

      setSaving(false);

    }

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


    setActionDoctorId(
      doctor.id,
    );

    setMessage("");
    setMessageType("");


    try {

      const response =
        await api(
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

      <main className="doctor-directory">

        <header className="doctor-directory-header">

          <div>

            <span>
              {doctors.length} mjekë gjithsej
            </span>

            <h1>Mjekët</h1>

            <p>
              Menaxhoni mjekët dhe shikoni
              gjendjen e tyre financiare.
            </p>

          </div>


          <div className="doctor-directory-actions">

            <button
              type="button"
              className="is-secondary"
              onClick={()=>
                setCatalogOpen(true)
              }
            >
              <Boxes
                size={15}
                aria-hidden="true"
              />

              Katalogu
            </button>


            <button
              type="button"
              className="is-primary"
              onClick={createDoctor}
            >
              <Plus
                size={15}
                aria-hidden="true"
              />

              Mjek i ri
            </button>

          </div>

        </header>


        <section className="doctor-directory-summary">

          <article>

            <Stethoscope
              size={18}
              aria-hidden="true"
            />

            <div>
              <span>Gjithsej</span>
              <strong>{doctors.length}</strong>
            </div>

          </article>


          <article className="is-active">

            <UserCheck
              size={18}
              aria-hidden="true"
            />

            <div>
              <span>Aktivë</span>
              <strong>
                {activeDoctorsCount}
              </strong>
            </div>

          </article>


          <article className="is-inactive">

            <UserX
              size={18}
              aria-hidden="true"
            />

            <div>
              <span>Jo aktivë</span>
              <strong>
                {inactiveDoctorsCount}
              </strong>
            </div>

          </article>


          <article className="is-debt">

            <CircleDollarSign
              size={18}
              aria-hidden="true"
            />

            <div>
              <span>Borxh total</span>

              <strong>
                {formatMoney(
                  totalOutstanding,
                )} €
              </strong>
            </div>

          </article>

        </section>


        <section className="doctor-directory-toolbar">

          <div className="doctor-directory-search">

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
              placeholder="Kërko mjekun ose telefonin..."
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
              Të gjithë mjekët
            </option>

            <option value="active">
              Vetëm aktivë
            </option>

            <option value="inactive">
              Vetëm jo aktivë
            </option>
          </select>


          <span>
            {filteredDoctors.length} rezultate
          </span>

        </section>


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


        {loading && (

          <section className="doctor-directory-empty">
            Duke ngarkuar...
          </section>

        )}


        {!loading &&
          filteredDoctors.length === 0 && (

            <section className="doctor-directory-empty">

              <Stethoscope
                size={28}
                aria-hidden="true"
              />

              <strong>
                Nuk u gjet asnjë mjek
              </strong>

              <span>
                Ndryshoni kërkimin ose filtrin.
              </span>

            </section>

          )}


        {!loading &&
          filteredDoctors.length > 0 && (

            <section className="doctor-directory-grid">

              {filteredDoctors.map(
                (doctor)=>{

                  const billed =
                    Math.max(
                      Number(
                        doctor.total_billed ||
                        0,
                      ),
                      0,
                    );

                  const paid =
                    Math.max(
                      Number(
                        doctor.total_paid ||
                        0,
                      ),
                      0,
                    );

                  const progress =
                    billed > 0
                      ? Math.min(
                          (
                            paid /
                            billed
                          ) * 100,
                          100,
                        )
                      : 0;


                  return (

                    <article
                      key={doctor.id}
                      className={
                        doctor.active
                          ? "doctor-directory-card"
                          : "doctor-directory-card is-disabled"
                      }
                    >

                      <header>

                        <span className="doctor-directory-avatar">
                          {getInitials(
                            doctor.name,
                          )}
                        </span>


                        <div className="doctor-directory-identity">

                          <strong>
                            {doctor.name}
                          </strong>

                          <span>
                            {
                              doctor.phone ??
                              "Pa telefon"
                            }
                          </span>

                        </div>


                        <span
                          className={
                            doctor.active
                              ? "doctor-directory-status is-active"
                              : "doctor-directory-status is-inactive"
                          }
                        >
                          {
                            doctor.active
                              ? "Aktiv"
                              : "Jo aktiv"
                          }
                        </span>

                      </header>


                      <div className="doctor-directory-finance">

                        <div>

                          <span>Borxhi</span>

                          <strong
                            className={
                              Number(
                                doctor
                                  .outstanding_balance,
                              ) > 0
                                ? "has-debt"
                                : ""
                            }
                          >
                            {
                              formatMoney(
                                doctor
                                  .outstanding_balance,
                              )
                            } €
                          </strong>

                        </div>


                        <div>

                          <span>Punë aktive</span>

                          <strong>
                            {
                              doctor
                                .active_work_count
                            }
                          </strong>

                        </div>


                        <div>

                          <span>Pa paguar</span>

                          <strong>
                            {
                              doctor
                                .unpaid_work_count
                            }
                          </strong>

                        </div>

                      </div>


                      <div className="doctor-directory-progress">

                        <div>
                          <span>Paguar</span>

                          <strong>
                            {
                              formatMoney(
                                doctor.total_paid,
                              )
                            } €
                          </strong>
                        </div>

                        <span className="doctor-directory-progress-track">

                          <i
                            style={{
                              width:
                                `${progress}%`,
                            }}
                          />

                        </span>

                      </div>


                      <footer>

                        <button
                          type="button"
                          className="doctor-directory-edit"
                          onClick={()=>
                            editDoctor(
                              doctor,
                            )
                          }
                        >
                          <Pencil
                            size={13}
                            aria-hidden="true"
                          />

                          Ndrysho
                        </button>


                        <button
                          type="button"
                          className={
                            doctor.active
                              ? "doctor-directory-toggle is-deactivate"
                              : "doctor-directory-toggle is-activate"
                          }
                          disabled={
                            actionDoctorId ===
                            doctor.id
                          }
                          onClick={()=>
                            void toggleStatus(
                              doctor,
                            )
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


                        <button
                          type="button"
                          className="doctor-directory-open"
                          onClick={()=>
                            navigate(
                              `/doctors/${doctor.id}`,
                            )
                          }
                        >
                          Hap kartelën

                          <ChevronRight
                            size={14}
                            aria-hidden="true"
                          />
                        </button>

                      </footer>

                    </article>

                  );

                },
              )}

            </section>

          )}


        {formOpen && (

          <div
            className="doctor-form-backdrop"
            role="presentation"
            onMouseDown={(event)=>{

              if(
                event.target ===
                event.currentTarget
              ) {
                closeForm();
              }

            }}
          >

            <section
              className="doctor-form-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="doctor-form-title"
            >

              <header>

                <div>

                  <span>
                    {
                      editingId === null
                        ? "Mjek i ri"
                        : "Ndrysho mjekun"
                    }
                  </span>

                  <h2 id="doctor-form-title">
                    {
                      editingId === null
                        ? "Shto një mjek"
                        : "Përditëso të dhënat"
                    }
                  </h2>

                </div>


                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  aria-label="Mbyll"
                >
                  <X
                    size={18}
                    aria-hidden="true"
                  />
                </button>

              </header>


              <form
                className="doctor-form-modal-body"
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
                    autoFocus
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


                <footer>

                  <button
                    type="button"
                    className="is-cancel"
                    onClick={closeForm}
                    disabled={saving}
                  >
                    Anulo
                  </button>


                  <button
                    type="submit"
                    className="is-save"
                    disabled={saving}
                  >
                    {
                      saving
                        ? "Duke ruajtur..."
                        : editingId === null
                          ? "Shto mjekun"
                          : "Ruaj ndryshimet"
                    }
                  </button>

                </footer>

              </form>

            </section>

          </div>

        )}


        {catalogOpen && (

          <div
            className="doctor-catalog-backdrop"
            role="presentation"
            onMouseDown={(event)=>{

              if(
                event.target ===
                event.currentTarget
              ) {
                setCatalogOpen(false);
              }

            }}
          >

            <section
              className="doctor-catalog-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="doctor-catalog-title"
            >

              <header>

                <div>

                  <span>
                    Konfigurimi i punëve
                  </span>

                  <h2 id="doctor-catalog-title">
                    Katalogu
                  </h2>

                </div>


                <button
                  type="button"
                  onClick={()=>
                    setCatalogOpen(false)
                  }
                  aria-label="Mbyll"
                >
                  <X
                    size={18}
                    aria-hidden="true"
                  />
                </button>

              </header>


              <nav className="doctor-catalog-tabs">

                <button
                  type="button"
                  className={
                    catalogTab === "materials"
                      ? "is-active"
                      : ""
                  }
                  onClick={()=>
                    setCatalogTab(
                      "materials",
                    )
                  }
                >
                  <Boxes size={15} />
                  Materialet
                </button>


                <button
                  type="button"
                  className={
                    catalogTab === "colors"
                      ? "is-active"
                      : ""
                  }
                  onClick={()=>
                    setCatalogTab(
                      "colors",
                    )
                  }
                >
                  <Palette size={15} />
                  Ngjyrat
                </button>

              </nav>


              <div className="doctor-catalog-content">

                {
                  catalogTab === "materials"
                    ? <MaterialsManager />
                    : <ColorsManager />
                }

              </div>

            </section>

          </div>

        )}

      </main>

    </Layout>

  );

}
