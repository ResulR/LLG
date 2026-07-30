import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Palette,
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


type Color = {
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


export default function ColorsManager() {

  const {
    confirmAction,
  } = useConfirm();

  const [
    colors,
    setColors,
  ] =
    useState<Color[]>([]);

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
    actionColorId,
    setActionColorId,
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


  const originalColor =
    useMemo(
      ()=>colors.find(
        (color)=>
          color.id === editingId,
      ) ?? null,
      [
        editingId,
        colors,
      ],
    );


  const formIsDirty =
    editingId === null
      ? Boolean(
          name.trim(),
        )
      : Boolean(
          originalColor &&
          name !== originalColor.name
        );


  useUnsavedChanges(
    "colors-form",
    formIsDirty,
  );


  const filteredColors =
    useMemo(
      ()=>{

        const normalizedSearch =
          search
            .trim()
            .toLowerCase();


        return colors.filter(
          (color)=>{

            const matchesSearch =
              color.name
                .toLowerCase()
                .includes(
                  normalizedSearch,
                );


            const matchesStatus =
              statusFilter === "all" ||
              (
                statusFilter === "active" &&
                color.active
              ) ||
              (
                statusFilter === "inactive" &&
                !color.active
              );


            return (
              matchesSearch &&
              matchesStatus
            );

          },
        );

      },
      [
        colors,
        search,
        statusFilter,
      ],
    );


  const activeCount =
    useMemo(
      ()=>colors.filter(
        (color)=>
          color.active,
      ).length,
      [colors],
    );


  function resetForm() {

    setName("");

    setEditingId(null);

  }


  async function loadColors() {

    setLoading(true);


    try {

      const response =
        await api(
          "/colors",
        );


      if(!response.ok) {

        throw new Error(
          "colors_load_failed",
        );

      }


      setColors(
        await response.json(),
      );


    } catch(error) {

      console.error(error);

      setMessage(
        "Coloret nuk mund të ngarkoheshin.",
      );

      setMessageType("error");


    } finally {

      setLoading(false);

    }

  }


  useEffect(
    ()=>{

      void loadColors();

    },
    [],
  );


  async function saveColor(
    event:React.FormEvent,
  ) {

    event.preventDefault();

    setMessage("");

    setMessageType("");


    const cleanName =
      name.trim();


    if(!cleanName) {

      setMessage(
        "Shkruani emrin e colorit.",
      );

      setMessageType("error");

      return;

    }


    setSaving(true);


    try {

      const response =
        await api(
          editingId === null
            ? "/colors"
            : `/colors/${editingId}`,
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
          "color_name_exists"
        ) {

          setMessage(
            "Një color me këtë emër ekziston tashmë.",
          );

          setMessageType("error");

          return;

        }


        throw new Error(
          "color_save_failed",
        );

      }


      const wasEditing =
        editingId !== null;

      resetForm();

      setMessage(
        wasEditing
          ? "Colori u përditësua me sukses."
          : "Colori u shtua me sukses.",
      );

      setMessageType("success");

      await loadColors();


    } catch(error) {

      console.error(error);

      setMessage(
        editingId === null
          ? "Colori nuk mund të shtohej."
          : "Colori nuk mund të përditësohej.",
      );

      setMessageType("error");


    } finally {

      setSaving(false);

    }

  }


  function editColor(
    color:Color,
  ) {

    setEditingId(
      color.id,
    );

    setName(
      color.name,
    );

    setMessage("");

    setMessageType("");

  }


  async function toggleColor(
    color:Color,
  ) {

    const nextStatus =
      !color.active;


    const confirmed =
      await confirmAction({
        title:
          nextStatus
            ? "Aktivizo ngjyrën"
            : "Çaktivizo ngjyrën",

        message:
          nextStatus
            ? `A dëshironi ta aktivizoni ngjyrën ${color.name}?`
            : `A dëshironi ta çaktivizoni ngjyrën ${color.name}?`,

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


    setActionColorId(
      color.id,
    );

    setMessage("");

    setMessageType("");


    try {

      const response =
        await api(
          `/colors/${color.id}/status`,
          {
            method:"PATCH",

            body:JSON.stringify({
              active:nextStatus,
            }),
          },
        );


      if(!response.ok) {

        throw new Error(
          "color_status_failed",
        );

      }


      setColors(
        (current)=>
          current.map(
            (item)=>
              item.id === color.id
                ? {
                    ...item,
                    active:nextStatus,
                  }
                : item,
          ),
      );


      setMessage(
        nextStatus
          ? "Colori u aktivizua."
          : "Colori u çaktivizua.",
      );

      setMessageType("success");


    } catch(error) {

      console.error(error);

      setMessage(
        "Statusi i colorit nuk mund të ndryshohej.",
      );

      setMessageType("error");


    } finally {

      setActionColorId(null);

    }

  }


  async function deleteColor(
    color:Color,
  ) {

    if(color.usage_count > 0) {

      setMessage(
        `Colori nuk mund të fshihet sepse përdoret në ${color.usage_count} punë. Mund ta çaktivizoni.`,
      );

      setMessageType("error");

      return;

    }


    const confirmed =
      await confirmAction({
        title:"Fshi ngjyrën",

        message:
          `A dëshironi ta fshini përfundimisht ngjyrën ${color.name}? Ky veprim nuk mund të zhbëhet.`,

        confirmLabel:"Fshi",
        tone:"danger",
      });


    if(!confirmed) {
      return;
    }


    setActionColorId(
      color.id,
    );

    setMessage("");

    setMessageType("");


    try {

      const response =
        await api(
          `/colors/${color.id}`,
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
          "color_in_use"
        ) {

          setMessage(
            "Colori përdoret në një ose më shumë punë dhe nuk mund të fshihet.",
          );

          setMessageType("error");

          return;

        }


        throw new Error(
          "color_delete_failed",
        );

      }


      if(editingId === color.id) {

        resetForm();

      }


      setColors(
        (current)=>
          current.filter(
            (item)=>
              item.id !== color.id,
          ),
      );


      setMessage(
        "Colori u fshi me sukses.",
      );

      setMessageType("success");


    } catch(error) {

      console.error(error);

      setMessage(
        "Colori nuk mund të fshihej.",
      );

      setMessageType("error");


    } finally {

      setActionColorId(null);

    }

  }


  return (
    <section className="materials-management colors-management">

      <header className="materials-management-header colors-management-header">

        <div>

          <span className="doctors-eyebrow">
            Konfigurimi i punëve
          </span>

          <h2>Coloret</h2>

          <p>
            Shtoni, ndryshoni dhe menaxhoni
            coloret e përdorura në punë.
          </p>

        </div>


        <div className="materials-summary colors-summary">

          <span>
            <Palette size={18} />

            {colors.length} gjithsej
          </span>

          <span>
            <Power size={18} />

            {activeCount} aktive
          </span>

        </div>

      </header>


      <div className="materials-main-grid colors-main-grid">

        <article className="materials-form-card colors-form-card">

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
                    ? "Shto color"
                    : "Ndrysho colorin"
                }
              </h3>

              <p>
                {
                  editingId === null
                    ? "Regjistroni një color të ri."
                    : "Përditësoni emrin e colorit."
                }
              </p>

            </div>

          </div>


          <form
            className="materials-form colors-form"
            onSubmit={saveColor}
          >

            <label>

              <span>
                Emri i colorit
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
                placeholder="P.sh. A1, A2, B1..."
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
                      ? "Shto colorin"
                      : "Ruaj ndryshimet"
                }
              </button>

            </div>

          </form>

        </article>


        <article className="materials-list-card colors-list-card">

          <div className="doctors-list-header">

            <div className="doctors-section-title">

              <span>
                <Palette size={20} />
              </span>

              <div>

                <h3>
                  Lista e coloreve
                </h3>

                <p>
                  {filteredColors.length} nga{" "}
                  {colors.length} colore
                </p>

              </div>

            </div>


            <button
              type="button"
              className="doctors-refresh-button"
              onClick={
                ()=>void loadColors()
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
                placeholder="Kërko colorin..."
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

            <table className="doctors-table colors-table">

              <thead>

                <tr>
                  <th>Colori</th>
                  <th>Përdorime</th>
                  <th>Statusi</th>
                  <th>Veprime</th>
                </tr>

              </thead>


              <tbody>

                {filteredColors.map(
                  (color)=>(

                    <tr key={color.id}>

                      <td>

                        <div className="materials-name-cell colors-name-cell">

                          <span>
                            <Palette size={17} />
                          </span>

                          <div>

                            <strong>
                              {color.name}
                            </strong>

                            <small>
                              Color #{color.id}
                            </small>

                          </div>

                        </div>

                      </td>


                      <td>

                        <span className="materials-usage colors-usage">

                          {color.usage_count}

                          {
                            color.usage_count === 1
                              ? " punë"
                              : " punë"
                          }

                        </span>

                      </td>


                      <td>

                        <span
                          className={
                            color.active
                              ? "doctors-status is-active"
                              : "doctors-status is-inactive"
                          }
                        >
                          {
                            color.active
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
                              ()=>editColor(
                                color,
                              )
                            }
                          >
                            <Pencil size={14} />

                            Ndrysho
                          </button>


                          <button
                            type="button"
                            className={
                              color.active
                                ? "doctors-status-button is-deactivate"
                                : "doctors-status-button is-activate"
                            }
                            disabled={
                              actionColorId ===
                              color.id
                            }
                            onClick={
                              ()=>void toggleColor(
                                color,
                              )
                            }
                          >
                            {
                              actionColorId === color.id
                                ? "..."
                                : color.active
                                  ? "Çaktivizo"
                                  : "Aktivizo"
                            }
                          </button>


                          <button
                            type="button"
                            className="materials-delete-button colors-delete-button"
                            disabled={
                              actionColorId ===
                                color.id ||
                              color.usage_count > 0
                            }
                            title={
                              color.usage_count > 0
                                ? "Colori përdoret në punë dhe nuk mund të fshihet."
                                : "Fshi colorin"
                            }
                            onClick={
                              ()=>void deleteColor(
                                color,
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
                  filteredColors.length === 0 && (

                    <tr>

                      <td
                        colSpan={4}
                        className="doctors-empty"
                      >
                        Nuk u gjet asnjë color.
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
