import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Boxes,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
} from "lucide-react";

import {
  api,
} from "@/lib/api";

import {
  useUnsavedChanges,
} from "@/lib/useUnsavedChanges";

import {
  useConfirm,
} from "@/context/ConfirmContext";

import AppToast from "@/components/AppToast";


type Material = {
  id:number;
  name:string;
  active:boolean;
  usage_count:number;
  created_at:string;
};


type MessageType =
  "success" |
  "error" |
  "";


export default function MaterialsManager() {

  const {
    confirmAction,
  } = useConfirm();

  const [
    materials,
    setMaterials,
  ] =
    useState<Material[]>([]);

  const [
    name,
    setName,
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
    actionMaterialId,
    setActionMaterialId,
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


  const originalMaterial =
    useMemo(
      ()=>materials.find(
        (material)=>
          material.id === editingId,
      ) ?? null,
      [
        editingId,
        materials,
      ],
    );


  const formIsDirty =
    editingId === null
      ? Boolean(
          name.trim(),
        )
      : Boolean(
          originalMaterial &&
          name !== originalMaterial.name
        );


  useUnsavedChanges(
    "materials-form",
    formIsDirty,
  );


  const filteredMaterials =
    useMemo(
      ()=>{

        const normalizedSearch =
          search
            .trim()
            .toLowerCase();


        return materials.filter(
          (material)=>{

            const matchesSearch =
              material.name
                .toLowerCase()
                .includes(
                  normalizedSearch,
                );


            const matchesStatus =
              statusFilter === "all" ||
              (
                statusFilter === "active" &&
                material.active
              ) ||
              (
                statusFilter === "inactive" &&
                !material.active
              );


            return (
              matchesSearch &&
              matchesStatus
            );

          },
        );

      },
      [
        materials,
        search,
        statusFilter,
      ],
    );


  const activeCount =
    useMemo(
      ()=>materials.filter(
        (material)=>
          material.active,
      ).length,
      [materials],
    );


  function resetForm() {

    setName("");

    setEditingId(null);

  }


  async function loadMaterials() {

    setLoading(true);


    try {

      const response =
        await api(
          "/materials",
        );


      if(!response.ok) {

        throw new Error(
          "materials_load_failed",
        );

      }


      setMaterials(
        await response.json(),
      );


    } catch(error) {

      console.error(error);

      setMessage(
        "Materialet nuk mund të ngarkoheshin.",
      );

      setMessageType("error");


    } finally {

      setLoading(false);

    }

  }


  useEffect(
    ()=>{

      void loadMaterials();

    },
    [],
  );


  async function saveMaterial(
    event:React.FormEvent,
  ) {

    event.preventDefault();

    setMessage("");

    setMessageType("");


    const cleanName =
      name.trim();


    if(!cleanName) {

      setMessage(
        "Shkruani emrin e materialit.",
      );

      setMessageType("error");

      return;

    }


    setSaving(true);


    try {

      const response =
        await api(
          editingId === null
            ? "/materials"
            : `/materials/${editingId}`,
          {
            method:
              editingId === null
                ? "POST"
                : "PUT",

            body:JSON.stringify({
              name:cleanName,
            }),
          },
        );


      if(!response.ok) {

        const data =
          await response
            .json()
            .catch(
              ()=>null,
            );


        if(
          data?.error ===
          "material_name_exists"
        ) {

          setMessage(
            "Një material me këtë emër ekziston tashmë.",
          );

          setMessageType("error");

          return;

        }


        throw new Error(
          "material_save_failed",
        );

      }


      const wasEditing =
        editingId !== null;

      resetForm();

      setMessage(
        wasEditing
          ? "Materiali u përditësua me sukses."
          : "Materiali u shtua me sukses.",
      );

      setMessageType("success");

      await loadMaterials();


    } catch(error) {

      console.error(error);

      setMessage(
        editingId === null
          ? "Materiali nuk mund të shtohej."
          : "Materiali nuk mund të përditësohej.",
      );

      setMessageType("error");


    } finally {

      setSaving(false);

    }

  }


  function editMaterial(
    material:Material,
  ) {

    setEditingId(
      material.id,
    );

    setName(
      material.name,
    );

    setMessage("");

    setMessageType("");

  }


  async function toggleMaterial(
    material:Material,
  ) {

    const nextStatus =
      !material.active;


    const confirmed =
      await confirmAction({
        title:
          nextStatus
            ? "Aktivizo materialin"
            : "Çaktivizo materialin",

        message:
          nextStatus
            ? `A dëshironi ta aktivizoni materialin ${material.name}?`
            : `A dëshironi ta çaktivizoni materialin ${material.name}?`,

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


    setActionMaterialId(
      material.id,
    );

    setMessage("");

    setMessageType("");


    try {

      const response =
        await api(
          `/materials/${material.id}/status`,
          {
            method:"PATCH",

            body:JSON.stringify({
              active:nextStatus,
            }),
          },
        );


      if(!response.ok) {

        throw new Error(
          "material_status_failed",
        );

      }


      setMaterials(
        (current)=>
          current.map(
            (item)=>
              item.id === material.id
                ? {
                    ...item,
                    active:nextStatus,
                  }
                : item,
          ),
      );


      setMessage(
        nextStatus
          ? "Materiali u aktivizua."
          : "Materiali u çaktivizua.",
      );

      setMessageType("success");


    } catch(error) {

      console.error(error);

      setMessage(
        "Statusi i materialit nuk mund të ndryshohej.",
      );

      setMessageType("error");


    } finally {

      setActionMaterialId(null);

    }

  }


  async function deleteMaterial(
    material:Material,
  ) {

    if(material.usage_count > 0) {

      setMessage(
        `Materiali nuk mund të fshihet sepse përdoret në ${material.usage_count} punë. Mund ta çaktivizoni.`,
      );

      setMessageType("error");

      return;

    }


    const confirmed =
      await confirmAction({
        title:"Fshi materialin",

        message:
          `A dëshironi ta fshini përfundimisht materialin ${material.name}? Ky veprim nuk mund të zhbëhet.`,

        confirmLabel:"Fshi",
        tone:"danger",
      });


    if(!confirmed) {
      return;
    }


    setActionMaterialId(
      material.id,
    );

    setMessage("");

    setMessageType("");


    try {

      const response =
        await api(
          `/materials/${material.id}`,
          {
            method:"DELETE",
          },
        );


      if(!response.ok) {

        const data =
          await response
            .json()
            .catch(
              ()=>null,
            );


        if(
          data?.error ===
          "material_in_use"
        ) {

          setMessage(
            "Materiali përdoret në një ose më shumë punë dhe nuk mund të fshihet.",
          );

          setMessageType("error");

          return;

        }


        throw new Error(
          "material_delete_failed",
        );

      }


      if(editingId === material.id) {

        resetForm();

      }


      setMaterials(
        (current)=>
          current.filter(
            (item)=>
              item.id !== material.id,
          ),
      );


      setMessage(
        "Materiali u fshi me sukses.",
      );

      setMessageType("success");


    } catch(error) {

      console.error(error);

      setMessage(
        "Materiali nuk mund të fshihej.",
      );

      setMessageType("error");


    } finally {

      setActionMaterialId(null);

    }

  }


  return (
    <section className="materials-management">

      <header className="materials-management-header">

        <div>

          <span className="doctors-eyebrow">
            Konfigurimi i punëve
          </span>

          <h2>Materialet</h2>

          <p>
            Shtoni, ndryshoni dhe menaxhoni
            materialet e përdorura në punë.
          </p>

        </div>


        <div className="materials-summary">

          <span>
            <Boxes size={18} />

            {materials.length} gjithsej
          </span>

          <span>
            <Power size={18} />

            {activeCount} aktive
          </span>

        </div>

      </header>


      <div className="materials-main-grid">

        <article className="materials-form-card">

          <div className="doctors-section-title">

            <span>
              {
                editingId === null
                  ? <Plus size={20} />
                  : <Pencil size={20} />
              }
            </span>

            <div>

              <h3>
                {
                  editingId === null
                    ? "Shto material"
                    : "Ndrysho materialin"
                }
              </h3>

              <p>
                {
                  editingId === null
                    ? "Regjistroni një material të ri."
                    : "Përditësoni emrin e materialit."
                }
              </p>

            </div>

          </div>


          <form
            className="materials-form"
            onSubmit={saveMaterial}
          >

            <label>

              <span>
                Emri i materialit
              </span>

              <input
                type="text"
                value={name}
                onChange={
                  (event)=>
                    setName(
                      event.target.value,
                    )
                }
                placeholder="P.sh. Zirkon"
                maxLength={120}
                disabled={saving}
                required
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

              {editingId !== null && (

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
                    : editingId === null
                      ? "Shto materialin"
                      : "Ruaj ndryshimet"
                }
              </button>

            </div>

          </form>

        </article>


        <article className="materials-list-card">

          <div className="doctors-list-header">

            <div className="doctors-section-title">

              <span>
                <Boxes size={20} />
              </span>

              <div>

                <h3>
                  Lista e materialeve
                </h3>

                <p>
                  {filteredMaterials.length} nga{" "}
                  {materials.length} materiale
                </p>

              </div>

            </div>


            <button
              type="button"
              className="doctors-refresh-button"
              onClick={
                ()=>void loadMaterials()
              }
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
                onChange={
                  (event)=>
                    setSearch(
                      event.target.value,
                    )
                }
                placeholder="Kërko materialin..."
              />

            </div>


            <select
              value={statusFilter}
              onChange={
                (event)=>
                  setStatusFilter(
                    event.target.value,
                  )
              }
            >
              <option value="all">
                Të gjitha statuset
              </option>

              <option value="active">
                Aktive
              </option>

              <option value="inactive">
                Jo aktive
              </option>
            </select>

          </div>


          <div className="doctors-table-scroll">

            <table className="doctors-table materials-table">

              <thead>

                <tr>
                  <th>Materiali</th>
                  <th>Përdorime</th>
                  <th>Statusi</th>
                  <th>Veprime</th>
                </tr>

              </thead>


              <tbody>

                {filteredMaterials.map(
                  (material)=>(

                    <tr key={material.id}>

                      <td>

                        <div className="materials-name-cell">

                          <span>
                            <Boxes size={17} />
                          </span>

                          <div>

                            <strong>
                              {material.name}
                            </strong>

                            <small>
                              Material #{material.id}
                            </small>

                          </div>

                        </div>

                      </td>


                      <td>

                        <span className="materials-usage">

                          {material.usage_count}

                          {
                            material.usage_count === 1
                              ? " punë"
                              : " punë"
                          }

                        </span>

                      </td>


                      <td>

                        <span
                          className={
                            material.active
                              ? "doctors-status is-active"
                              : "doctors-status is-inactive"
                          }
                        >
                          {
                            material.active
                              ? "Aktiv"
                              : "Jo aktiv"
                          }
                        </span>

                      </td>


                      <td>

                        <div className="doctors-row-actions">

                          <button
                            type="button"
                            className="doctors-edit-button"
                            onClick={
                              ()=>editMaterial(
                                material,
                              )
                            }
                          >
                            <Pencil size={14} />

                            Ndrysho
                          </button>


                          <button
                            type="button"
                            className={
                              material.active
                                ? "doctors-status-button is-deactivate"
                                : "doctors-status-button is-activate"
                            }
                            disabled={
                              actionMaterialId ===
                              material.id
                            }
                            onClick={
                              ()=>void toggleMaterial(
                                material,
                              )
                            }
                          >
                            {
                              actionMaterialId === material.id
                                ? "..."
                                : material.active
                                  ? "Çaktivizo"
                                  : "Aktivizo"
                            }
                          </button>


                          <button
                            type="button"
                            className="materials-delete-button"
                            disabled={
                              actionMaterialId ===
                                material.id ||
                              material.usage_count > 0
                            }
                            title={
                              material.usage_count > 0
                                ? "Materiali përdoret në punë dhe nuk mund të fshihet."
                                : "Fshi materialin"
                            }
                            onClick={
                              ()=>void deleteMaterial(
                                material,
                              )
                            }
                          >
                            <Trash2 size={14} />

                            Fshi
                          </button>

                        </div>

                      </td>

                    </tr>

                  ),
                )}


                {!loading &&
                  filteredMaterials.length === 0 && (

                    <tr>

                      <td
                        colSpan={4}
                        className="doctors-empty"
                      >
                        Nuk u gjet asnjë material.
                      </td>

                    </tr>

                  )}


                {loading && (

                  <tr>

                    <td
                      colSpan={4}
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

      </div>

    </section>
  );

}
