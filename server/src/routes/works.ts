import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();


const validTeeth = new Set([
  11,12,13,14,15,16,17,18,
  21,22,23,24,25,26,27,28,
  31,32,33,34,35,36,37,38,
  41,42,43,44,45,46,47,48,
]);


router.get("/references", requireAuth, async (_req, res) => {

  const doctors = await pool.query(`
    SELECT id, name
    FROM doctors
    WHERE active = true
    ORDER BY name
  `);

  const materials = await pool.query(`
    SELECT
      id,
      name,
      active
    FROM materials
    WHERE active = true
    ORDER BY name
  `);

  const colors = await pool.query(`
    SELECT id, name
    FROM colors
    WHERE active = true
    ORDER BY name
  `);


  res.json({
    doctors: doctors.rows,
    materials: materials.rows,
    colors: colors.rows,
  });

});



router.get("/", requireAuth, async (req, res) => {

  const selectedMonth =
    String(
      req.query.month ?? "",
    ).trim();

  const validMonth =
    /^\d{4}-\d{2}$/.test(
      selectedMonth,
    );

  const result = await pool.query(
    `

    SELECT
      w.id,
      w.doctor_id,
      w.patient_id,
      w.material_id,
      w.color_id,
      w.year,
      w.month,
      w.monthly_number,
      w.work_date,
      w.description,
      w.is_repeat,
      w.pricing_mode,
      w.price_per_tooth,
      w.total_amount,
      w.status,

      d.name AS doctor_name,

      p.first_name,
      p.last_name,

      m.name AS material_name,
      c.name AS color_name,

      ARRAY_AGG(
        json_build_object(
          'number', wt.tooth_number,
          'is_antar', wt.is_antar
        )
        ORDER BY wt.tooth_number
      )
      FILTER (WHERE wt.tooth_number IS NOT NULL)
      AS teeth

    FROM works w

    JOIN doctors d
      ON d.id = w.doctor_id

    JOIN patients p
      ON p.id = w.patient_id

    LEFT JOIN materials m
      ON m.id = w.material_id

    LEFT JOIN colors c
      ON c.id = w.color_id

    LEFT JOIN work_teeth wt
      ON wt.work_id = w.id

    WHERE (
      $1::text IS NULL
      OR (
        w.work_date >=
          TO_DATE(
            $1 || '-01',
            'YYYY-MM-DD'
          )
        AND w.work_date <
          TO_DATE(
            $1 || '-01',
            'YYYY-MM-DD'
          )
          + INTERVAL '1 month'
      )
    )

    GROUP BY
      w.id,
      d.name,
      p.first_name,
      p.last_name,
      m.name,
      c.name

    ORDER BY w.created_at DESC

    `,
    [
      validMonth
        ? selectedMonth
        : null,
    ],
  );


  res.json(result.rows);

});



router.post("/", requireAuth, async (req, res) => {


  const {
    doctor_id,
    patient_first_name,
    patient_last_name,
    teeth,
    material_id,
    color_id,
    description,
    is_repeat,
    pricing_mode,
    price_per_tooth,
  } = req.body;



  const cleanFirstName =
    String(patient_first_name || "").trim();


  const cleanLastName =
    String(patient_last_name || "").trim();


  const cleanDescription =
    String(description ?? "").trim();


  const isRepeat =
    is_repeat === true;


  const pricingMode =
    pricing_mode === "fixed_total"
      ? "fixed_total"
      : "per_tooth";



  const price =
    Number(price_per_tooth || 0);



  if (
    !doctor_id ||
    !cleanFirstName ||
    !cleanLastName ||
    !Array.isArray(teeth) ||
    teeth.length === 0
  ) {

    return res.status(400).json({
      error:"missing_fields",
    });

  }



  if(cleanDescription.length > 2000) {

    return res.status(400).json({
      error:"description_too_long",
    });

  }



  if (
    !Number.isFinite(price) ||
    price < 0
  ) {

    return res.status(400).json({
      error:"invalid_price",
    });

  }



  if (
    teeth.some(
      (tooth:any) =>
        !validTeeth.has(Number(tooth.number)) ||
        typeof tooth.is_antar !== "boolean"
    )
  ) {

    return res.status(400).json({
      error:"invalid_teeth",
    });

  }



  const client = await pool.connect();



  try {

    await client.query("BEGIN");


    const doctorReference =
      await client.query(
        `
          SELECT id
          FROM doctors
          WHERE id = $1
            AND active = true
        `,
        [doctor_id],
      );


    if(doctorReference.rowCount === 0) {

      await client.query("ROLLBACK");

      return res.status(400).json({
        error:"invalid_doctor",
      });

    }


    if(material_id) {

      const materialReference =
        await client.query(
          `
            SELECT id
            FROM materials
            WHERE id = $1
              AND active = true
          `,
          [material_id],
        );


      if(materialReference.rowCount === 0) {

        await client.query("ROLLBACK");

        return res.status(400).json({
          error:"invalid_material",
        });

      }

    }


    if(color_id) {

      const colorReference =
        await client.query(
          `
            SELECT id
            FROM colors
            WHERE id = $1
              AND active = true
          `,
          [color_id],
        );


      if(colorReference.rowCount === 0) {

        await client.query("ROLLBACK");

        return res.status(400).json({
          error:"invalid_color",
        });

      }

    }



    let patient = await client.query(
      `
      SELECT id
      FROM patients
      WHERE LOWER(first_name)=LOWER($1)
      AND LOWER(last_name)=LOWER($2)
      LIMIT 1
      `,
      [
        cleanFirstName,
        cleanLastName,
      ],
    );



    let patientId;



    if(patient.rowCount){

      patientId = patient.rows[0].id;

    } else {


      const created = await client.query(
        `
        INSERT INTO patients (
          first_name,
          last_name
        )

        VALUES ($1,$2)

        RETURNING id
        `,
        [
          cleanFirstName,
          cleanLastName,
        ],
      );


      patientId = created.rows[0].id;

    }



    const now = new Date();

    const year = now.getFullYear();

    const month = now.getMonth()+1;



    const counter = await client.query(
      `
      INSERT INTO work_counters(
        doctor_id,
        year,
        month,
        last_number
      )

      VALUES($1,$2,$3,1)

      ON CONFLICT(
        doctor_id,
        year,
        month
      )

      DO UPDATE SET
        last_number =
        work_counters.last_number + 1

      RETURNING last_number
      `,
      [
        doctor_id,
        year,
        month,
      ],
    );



    const monthlyNumber =
      counter.rows[0].last_number;



    const storedPricePerTooth =
      pricingMode === "per_tooth"
        ? price
        : 0;


    const total =
      pricingMode === "fixed_total"
        ? price
        : price * teeth.length;



    const work = await client.query(
      `
      INSERT INTO works(
        doctor_id,
        patient_id,
        year,
        month,
        monthly_number,
        material_id,
        color_id,
        description,
        is_repeat,
        pricing_mode,
        price_per_tooth,
        total_amount,
        status
      )

      VALUES(
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active'
      )

      RETURNING *
      `,
      [
        doctor_id,
        patientId,
        year,
        month,
        monthlyNumber,
        material_id || null,
        color_id || null,
        cleanDescription || null,
        isRepeat,
        pricingMode,
        storedPricePerTooth,
        total,
      ],
    );



    for(const tooth of teeth){

      await client.query(
        `
        INSERT INTO work_teeth(
          work_id,
          tooth_number,
          is_antar
        )

        VALUES($1,$2,$3)
        `,
        [
          work.rows[0].id,
          Number(tooth.number),
          tooth.is_antar,
        ],
      );

    }



    await client.query("COMMIT");


    res.status(201).json(work.rows[0]);



  } catch(error){

    await client.query("ROLLBACK");


    console.error(error);


    res.status(500).json({
      error:"work_creation_failed",
    });


  } finally {

    client.release();

  }


});


router.put("/:id", requireAuth, async (req, res) => {

  const workId = Number(req.params.id);

  const {
    doctor_id,
    patient_first_name,
    patient_last_name,
    teeth,
    material_id,
    color_id,
    description,
    is_repeat,
    pricing_mode,
    price_per_tooth,
  } = req.body;


  const doctorId = Number(doctor_id);

  const materialId =
    material_id === null ||
    material_id === undefined ||
    material_id === ""
      ? null
      : Number(material_id);

  const colorId =
    color_id === null ||
    color_id === undefined ||
    color_id === ""
      ? null
      : Number(color_id);

  const cleanFirstName =
    String(patient_first_name ?? "").trim();

  const cleanLastName =
    String(patient_last_name ?? "").trim();

  const cleanDescription =
    String(description ?? "").trim();

  const isRepeat =
    is_repeat === true;

  const pricingMode =
    pricing_mode === "fixed_total"
      ? "fixed_total"
      : "per_tooth";

  const price = Number(price_per_tooth);


  if(
    !Number.isInteger(workId) ||
    workId <= 0
  ){

    return res.status(400).json({
      error:"invalid_work_id",
    });

  }


  if(
    !Number.isInteger(doctorId) ||
    doctorId <= 0 ||
    !cleanFirstName ||
    !cleanLastName ||
    !Array.isArray(teeth) ||
    teeth.length === 0
  ){

    return res.status(400).json({
      error:"missing_fields",
    });

  }


  if(cleanDescription.length > 2000){

    return res.status(400).json({
      error:"description_too_long",
    });

  }


  if(
    !Number.isFinite(price) ||
    price <= 0
  ){

    return res.status(400).json({
      error:"invalid_price",
    });

  }


  if(
    materialId !== null &&
    (
      !Number.isInteger(materialId) ||
      materialId <= 0
    )
  ){

    return res.status(400).json({
      error:"invalid_material",
    });

  }


  if(
    colorId !== null &&
    (
      !Number.isInteger(colorId) ||
      colorId <= 0
    )
  ){

    return res.status(400).json({
      error:"invalid_color",
    });

  }


  const normalizedTeeth = teeth.map(
    (tooth:any)=>({
      number:Number(tooth?.number),
      is_antar:tooth?.is_antar,
    })
  );


  if(
    normalizedTeeth.some(
      (tooth:any)=>
        !validTeeth.has(tooth.number) ||
        typeof tooth.is_antar !== "boolean"
    )
  ){

    return res.status(400).json({
      error:"invalid_teeth",
    });

  }


  const uniqueTeeth = new Set(
    normalizedTeeth.map(
      (tooth:any)=>tooth.number
    )
  );


  if(uniqueTeeth.size !== normalizedTeeth.length){

    return res.status(400).json({
      error:"duplicate_teeth",
    });

  }


  const client = await pool.connect();


  try{

    await client.query("BEGIN");


    const existingWork = await client.query(
      `
      SELECT
        id,
        material_id
      FROM works
      WHERE id = $1
      FOR UPDATE
      `,
      [workId],
    );


    if(existingWork.rowCount === 0){

      await client.query("ROLLBACK");

      return res.status(404).json({
        error:"work_not_found",
      });

    }


    const doctor = await client.query(
      `
      SELECT id
      FROM doctors
      WHERE id = $1
      `,
      [doctorId],
    );


    if(doctor.rowCount === 0){

      await client.query("ROLLBACK");

      return res.status(400).json({
        error:"invalid_doctor",
      });

    }


    if(materialId !== null){

      const material = await client.query(
        `
        SELECT
          id,
          active
        FROM materials
        WHERE id = $1
        `,
        [materialId],
      );


      const existingMaterialId =
        existingWork.rows[0].material_id === null
          ? null
          : Number(
              existingWork.rows[0].material_id,
            );


      if(
        material.rowCount === 0 ||
        (
          material.rows[0].active !== true &&
          materialId !== existingMaterialId
        )
      ){

        await client.query("ROLLBACK");

        return res.status(400).json({
          error:"invalid_material",
        });

      }

    }


    if(colorId !== null){

      const color = await client.query(
        `
        SELECT id
        FROM colors
        WHERE id = $1
        `,
        [colorId],
      );


      if(color.rowCount === 0){

        await client.query("ROLLBACK");

        return res.status(400).json({
          error:"invalid_color",
        });

      }

    }


    let patient = await client.query(
      `
      SELECT id
      FROM patients
      WHERE LOWER(first_name) = LOWER($1)
        AND LOWER(last_name) = LOWER($2)
      ORDER BY id
      LIMIT 1
      `,
      [
        cleanFirstName,
        cleanLastName,
      ],
    );


    let patientId:number;


    if(patient.rowCount){

      patientId = Number(patient.rows[0].id);

    }else{

      const createdPatient = await client.query(
        `
        INSERT INTO patients(
          first_name,
          last_name
        )
        VALUES($1,$2)
        RETURNING id
        `,
        [
          cleanFirstName,
          cleanLastName,
        ],
      );

      patientId = Number(
        createdPatient.rows[0].id
      );

    }


    const storedPricePerTooth =
      pricingMode === "per_tooth"
        ? price
        : 0;


    const total =
      pricingMode === "fixed_total"
        ? price
        : price * normalizedTeeth.length;


    const updatedWork = await client.query(
      `
      UPDATE works

      SET
        doctor_id = $1,
        patient_id = $2,
        material_id = $3,
        color_id = $4,
        description = $5,
        is_repeat = $6,
        pricing_mode = $7,
        price_per_tooth = $8,
        total_amount = $9,
        updated_at = NOW()

      WHERE id = $10

      RETURNING *
      `,
      [
        doctorId,
        patientId,
        materialId,
        colorId,
        cleanDescription || null,
        isRepeat,
        pricingMode,
        storedPricePerTooth,
        total,
        workId,
      ],
    );


    await client.query(
      `
      DELETE FROM work_teeth
      WHERE work_id = $1
      `,
      [workId],
    );


    for(const tooth of normalizedTeeth){

      await client.query(
        `
        INSERT INTO work_teeth(
          work_id,
          tooth_number,
          is_antar
        )
        VALUES($1,$2,$3)
        `,
        [
          workId,
          tooth.number,
          tooth.is_antar,
        ],
      );

    }


    await client.query("COMMIT");


    return res.json(
      updatedWork.rows[0]
    );


  }catch(error){

    await client.query("ROLLBACK");

    console.error(error);

    return res.status(500).json({
      error:"work_update_failed",
    });


  }finally{

    client.release();

  }

});


router.patch("/:id/status", requireAuth, async (req, res) => {

  const workId = Number(req.params.id);
  const status = String(req.body?.status ?? "");


  if(
    !Number.isInteger(workId) ||
    workId <= 0 ||
    !["active", "cancelled"].includes(status)
  ){

    return res.status(400).json({
      error:"invalid_work_status",
    });

  }


  try{

    const result = await pool.query(
      `
      UPDATE works

      SET
        status = $1,
        updated_at = NOW()

      WHERE id = $2

      RETURNING
        id,
        status,
        updated_at
      `,
      [
        status,
        workId,
      ],
    );


    if(result.rowCount === 0){

      return res.status(404).json({
        error:"work_not_found",
      });

    }


    return res.json(result.rows[0]);


  }catch(error){

    console.error(error);

    return res.status(500).json({
      error:"work_status_update_failed",
    });

  }

});


export { router as worksRouter };
