import { Router } from "express";

import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";


const router = Router();


router.get(
  "/references",
  requireAuth,
  async (_req, res) => {

    try {

      const doctors = await pool.query(`
        SELECT
          id,
          name

        FROM doctors

        WHERE active = true

        ORDER BY name
      `);


      return res.json({
        doctors:doctors.rows,
      });


    } catch(error) {

      console.error(error);

      return res.status(500).json({
        error:"payment_references_failed",
      });

    }

  },
);


router.get(
  "/summary",
  requireAuth,
  async (_req, res) => {

    try {

      const globalResult = await pool.query(`
        SELECT
          COALESCE(
            (
              SELECT SUM(w.total_amount)
              FROM works w
              WHERE w.status = 'active'
            ),
            0
          ) AS total_billed,

          COALESCE(
            (
              SELECT SUM(p.amount)
              FROM payments p
            ),
            0
          ) AS total_paid,

          (
            COALESCE(
              (
                SELECT SUM(w.total_amount)
                FROM works w
                WHERE w.status = 'active'
              ),
              0
            )
            -
            COALESCE(
              (
                SELECT SUM(p.amount)
                FROM payments p
              ),
              0
            )
          ) AS balance,

          (
            SELECT COUNT(*)
            FROM payments
          )::int AS payment_count
      `);


      const doctorsResult = await pool.query(`
        SELECT
          d.id AS doctor_id,
          d.name AS doctor_name,

          COALESCE(w.total_billed, 0)
            AS total_billed,

          COALESCE(p.total_paid, 0)
            AS total_paid,

          (
            COALESCE(w.total_billed, 0)
            -
            COALESCE(p.total_paid, 0)
          ) AS balance

        FROM doctors d

        LEFT JOIN (
          SELECT
            doctor_id,
            SUM(total_amount) AS total_billed

          FROM works

          WHERE status = 'active'

          GROUP BY doctor_id
        ) w
          ON w.doctor_id = d.id

        LEFT JOIN (
          SELECT
            doctor_id,
            SUM(amount) AS total_paid

          FROM payments

          GROUP BY doctor_id
        ) p
          ON p.doctor_id = d.id

        ORDER BY d.name
      `);


      return res.json({
        ...globalResult.rows[0],
        doctors:doctorsResult.rows,
      });


    } catch(error) {

      console.error(error);

      return res.status(500).json({
        error:"payment_summary_failed",
      });

    }

  },
);


router.get(
  "/",
  requireAuth,
  async (req, res) => {

    try {

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
          p.id,
          p.doctor_id,
          p.amount,
          p.payment_date,
          p.note,
          p.created_at,

          d.name AS doctor_name

        FROM payments p

        JOIN doctors d
          ON d.id = p.doctor_id

        WHERE (
          $1::text IS NULL
          OR (
            p.payment_date >=
              TO_DATE(
                $1 || '-01',
                'YYYY-MM-DD'
              )
            AND p.payment_date <
              TO_DATE(
                $1 || '-01',
                'YYYY-MM-DD'
              )
              + INTERVAL '1 month'
          )
        )

        ORDER BY
          p.payment_date DESC,
          p.id DESC
        `,
        [
          validMonth
            ? selectedMonth
            : null,
        ],
      );


      return res.json(result.rows);


    } catch(error) {

      console.error(error);

      return res.status(500).json({
        error:"payments_load_failed",
      });

    }

  },
);


router.post(
  "/",
  requireAuth,
  async (req, res) => {

    const doctorId =
      Number(req.body?.doctor_id);

    const amount =
      Number(req.body?.amount);

    const note =
      String(req.body?.note ?? "")
        .trim();


    if(
      !Number.isInteger(doctorId) ||
      doctorId <= 0
    ) {

      return res.status(400).json({
        error:"invalid_doctor",
      });

    }


    if(
      !Number.isFinite(amount) ||
      amount <= 0
    ) {

      return res.status(400).json({
        error:"invalid_amount",
      });

    }


    try {

      const doctor = await pool.query(
        `
        SELECT id
        FROM doctors
        WHERE id = $1
        `,
        [doctorId],
      );


      if(doctor.rowCount === 0) {

        return res.status(400).json({
          error:"invalid_doctor",
        });

      }


      const result = await pool.query(
        `
        INSERT INTO payments(
          doctor_id,
          amount,
          note
        )

        VALUES($1,$2,$3)

        RETURNING *
        `,
        [
          doctorId,
          amount,
          note || null,
        ],
      );


      return res
        .status(201)
        .json(result.rows[0]);


    } catch(error) {

      console.error(error);

      return res.status(500).json({
        error:"payment_creation_failed",
      });

    }

  },
);



router.get(
  "/unpaid-works",
  requireAuth,
  async (req, res) => {

    const doctorId =
      req.query.doctor_id
        ? Number(req.query.doctor_id)
        : null;

    const sortDirection =
      String(req.query.sort ?? "asc")
        .toLowerCase() === "desc"
        ? "DESC"
        : "ASC";


    if(
      doctorId !== null &&
      (
        !Number.isInteger(doctorId) ||
        doctorId <= 0
      )
    ) {

      return res.status(400).json({
        error:"invalid_doctor",
      });

    }


    try {

      const parameters:any[] = [];

      let doctorFilter = "";


      if(doctorId !== null) {

        parameters.push(doctorId);

        doctorFilter =
          `AND w.doctor_id = $${parameters.length}`;

      }


      const result = await pool.query(
        `
        WITH individual_payments AS (
          SELECT
            work_id,
            COALESCE(SUM(amount), 0)
              AS paid_amount

          FROM payments

          WHERE payment_type = 'individual'
            AND work_id IS NOT NULL

          GROUP BY work_id
        )

        SELECT
          w.id,
          w.doctor_id,
          w.patient_id,
          w.year,
          w.month,
          w.monthly_number,
          w.work_date,
          w.description,
          w.is_repeat,
          w.pricing_mode,
          w.price_per_tooth,
          w.original_total_amount,
          w.discount_total,
          w.total_amount,
          w.payment_status,

          d.name AS doctor_name,

          p.first_name,
          p.last_name,

          m.name AS material_name,
          c.name AS color_name,

          COALESCE(ip.paid_amount, 0)
            AS paid_amount,

          GREATEST(
            w.total_amount
              - COALESCE(ip.paid_amount, 0),
            0
          ) AS remaining_amount,

          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'number',
                wt.tooth_number,

                'is_antar',
                wt.is_antar
              )
              ORDER BY wt.tooth_number
            )
            FILTER (
              WHERE wt.id IS NOT NULL
            ),
            '[]'::json
          ) AS teeth

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

        LEFT JOIN individual_payments ip
          ON ip.work_id = w.id

        WHERE w.status = 'active'

          AND w.payment_status IN (
            'unpaid',
            'partial'
          )

          ${doctorFilter}

        GROUP BY
          w.id,
          d.name,
          p.first_name,
          p.last_name,
          m.name,
          c.name,
          ip.paid_amount

        HAVING
          GREATEST(
            w.total_amount
              - COALESCE(ip.paid_amount, 0),
            0
          ) > 0

        ORDER BY
          w.work_date ${sortDirection},
          w.id ${sortDirection}
        `,
        parameters,
      );


      return res.json(result.rows);


    } catch(error) {

      console.error(
        "Unpaid works load failed",
        error,
      );

      return res.status(500).json({
        error:"unpaid_works_load_failed",
      });

    }

  },
);


router.get(
  "/work/:id",
  requireAuth,
  async (req, res) => {

    const workId =
      Number(req.params.id);


    if(
      !Number.isInteger(workId) ||
      workId <= 0
    ) {

      return res.status(400).json({
        error:"invalid_work",
      });

    }


    try {

      const workResult = await pool.query(
        `
        WITH individual_payments AS (
          SELECT
            work_id,
            COALESCE(SUM(amount), 0)
              AS paid_amount

          FROM payments

          WHERE payment_type = 'individual'
            AND work_id = $1

          GROUP BY work_id
        )

        SELECT
          w.id,
          w.doctor_id,
          w.patient_id,
          w.year,
          w.month,
          w.monthly_number,
          w.work_date,
          w.description,
          w.is_repeat,
          w.pricing_mode,
          w.price_per_tooth,
          w.original_total_amount,
          w.discount_total,
          w.total_amount,
          w.payment_status,
          w.status,

          d.name AS doctor_name,

          p.first_name,
          p.last_name,

          m.name AS material_name,
          c.name AS color_name,

          COALESCE(ip.paid_amount, 0)
            AS paid_amount,

          GREATEST(
            w.total_amount
              - COALESCE(ip.paid_amount, 0),
            0
          ) AS remaining_amount,

          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'number',
                wt.tooth_number,

                'is_antar',
                wt.is_antar
              )
              ORDER BY wt.tooth_number
            )
            FILTER (
              WHERE wt.id IS NOT NULL
            ),
            '[]'::json
          ) AS teeth

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

        LEFT JOIN individual_payments ip
          ON ip.work_id = w.id

        WHERE w.id = $1

        GROUP BY
          w.id,
          d.name,
          p.first_name,
          p.last_name,
          m.name,
          c.name,
          ip.paid_amount
        `,
        [workId],
      );


      if(workResult.rowCount === 0) {

        return res.status(404).json({
          error:"work_not_found",
        });

      }


      const paymentsResult = await pool.query(
        `
        SELECT
          id,
          amount,
          discount_amount,
          payment_date,
          note,
          created_at

        FROM payments

        WHERE work_id = $1
          AND payment_type = 'individual'

        ORDER BY
          payment_date DESC,
          id DESC
        `,
        [workId],
      );


      const priceChangesResult =
        await pool.query(
          `
          SELECT
            id,
            work_id,
            previous_total_amount,
            new_total_amount,
            change_date,
            note,
            created_at

          FROM work_price_changes

          WHERE work_id = $1

          ORDER BY
            change_date DESC,
            id DESC
          `,
          [workId],
        );


      return res.json({
        work:workResult.rows[0],
        payments:paymentsResult.rows,
        price_changes:
          priceChangesResult.rows,
      });


    } catch(error) {

      console.error(
        "Work payment details failed",
        error,
      );

      return res.status(500).json({
        error:"work_payment_details_failed",
      });

    }

  },
);


router.post(
  "/work/:id",
  requireAuth,
  async (req, res) => {

    const workId =
      Number(req.params.id);

    const amount =
      Number(req.body?.amount ?? 0);

    const hasFinalAmount =
      req.body?.final_amount !== undefined
      &&
      req.body?.final_amount !== null
      &&
      String(req.body.final_amount).trim() !== "";

    const requestedFinalAmount =
      hasFinalAmount
        ? Number(req.body.final_amount)
        : null;

    const note =
      String(req.body?.note ?? "")
        .trim();

    const paymentDate =
      req.body?.payment_date
        ? String(req.body.payment_date)
        : null;


    if(
      !Number.isInteger(workId) ||
      workId <= 0
    ) {

      return res.status(400).json({
        error:"invalid_work",
      });

    }


    if(
      !Number.isFinite(amount) ||
      amount < 0
    ) {

      return res.status(400).json({
        error:"invalid_amount",
      });

    }


    if(
      hasFinalAmount &&
      (
        !Number.isFinite(
          requestedFinalAmount,
        )
        ||
        Number(requestedFinalAmount) < 0
      )
    ) {

      return res.status(400).json({
        error:"invalid_final_amount",
      });

    }


    if(
      amount <= 0 &&
      !hasFinalAmount
    ) {

      return res.status(400).json({
        error:"empty_payment_operation",
      });

    }


    if(note.length > 500) {

      return res.status(400).json({
        error:"note_too_long",
      });

    }


    const client =
      await pool.connect();


    try {

      await client.query("BEGIN");


      const workResult =
        await client.query(
          `
          SELECT
            id,
            doctor_id,
            total_amount,
            original_total_amount,
            payment_status,
            status

          FROM works

          WHERE id = $1

          FOR UPDATE
          `,
          [workId],
        );


      if(workResult.rowCount === 0) {

        await client.query("ROLLBACK");

        return res.status(404).json({
          error:"work_not_found",
        });

      }


      const work =
        workResult.rows[0];


      if(
        work.status !== "active" ||
        work.payment_status ===
          "closed_global"
      ) {

        await client.query("ROLLBACK");

        return res.status(409).json({
          error:"work_not_payable",
        });

      }


      const paidResult =
        await client.query(
          `
          SELECT
            COALESCE(
              SUM(amount),
              0
            ) AS paid_amount

          FROM payments

          WHERE work_id = $1
            AND payment_type = 'individual'
          `,
          [workId],
        );


      const paidBefore =
        Number(
          paidResult.rows[0].paid_amount,
        );

      const currentFinalAmount =
        Number(work.total_amount);

      const newFinalAmount =
        hasFinalAmount
          ? Number(requestedFinalAmount)
          : currentFinalAmount;


      if(
        newFinalAmount + 0.0001
        < paidBefore
      ) {

        await client.query("ROLLBACK");

        return res.status(400).json({
          error:"final_amount_below_paid",

          paid_amount:
            paidBefore.toFixed(2),

          minimum_final_amount:
            paidBefore.toFixed(2),
        });

      }


      const remainingBeforePayment =
        Math.max(
          newFinalAmount - paidBefore,
          0,
        );


      if(
        amount >
        remainingBeforePayment + 0.0001
      ) {

        await client.query("ROLLBACK");

        return res.status(400).json({
          error:"amount_exceeds_remaining",

          final_amount:
            newFinalAmount.toFixed(2),

          paid_amount:
            paidBefore.toFixed(2),

          remaining_amount:
            remainingBeforePayment.toFixed(2),
        });

      }


      const finalAmountChanged =
        Math.abs(
          newFinalAmount
          - currentFinalAmount,
        ) > 0.0001;


      if(
        amount <= 0 &&
        !finalAmountChanged
      ) {

        await client.query("ROLLBACK");

        return res.status(400).json({
          error:"empty_payment_operation",
        });

      }


      if(finalAmountChanged) {

        await client.query(
          `
          INSERT INTO work_price_changes(
            work_id,
            previous_total_amount,
            new_total_amount,
            change_date,
            note
          )

          VALUES(
            $1,
            $2,
            $3,
            COALESCE($4::date, CURRENT_DATE),
            $5
          )
          `,
          [
            workId,
            currentFinalAmount,
            newFinalAmount,
            paymentDate,
            note || null,
          ],
        );

      }


      let payment = null;


      if(amount > 0) {

        const paymentResult =
          await client.query(
            `
            INSERT INTO payments(
              doctor_id,
              work_id,
              amount,
              discount_amount,
              payment_type,
              payment_date,
              note
            )

            VALUES(
              $1,
              $2,
              $3,
              0,
              'individual',
              COALESCE($4::date, CURRENT_DATE),
              $5
            )

            RETURNING *
            `,
            [
              work.doctor_id,
              workId,
              amount,
              paymentDate,
              note || null,
            ],
          );


        payment =
          paymentResult.rows[0];

      }


      const paidAfter =
        paidBefore + amount;

      const remainingAfter =
        Math.max(
          newFinalAmount - paidAfter,
          0,
        );

      const newPaymentStatus =
        remainingAfter <= 0.0001
          ? "paid"
          : paidAfter > 0
            ? "partial"
            : "unpaid";


      await client.query(
        `
        UPDATE works

        SET
          total_amount = $1,
          payment_status = $2,
          updated_at = NOW()

        WHERE id = $3
        `,
        [
          newFinalAmount,
          newPaymentStatus,
          workId,
        ],
      );


      await client.query("COMMIT");


      return res.status(201).json({
        payment,
        final_amount_changed:
          finalAmountChanged,

        previous_final_amount:
          currentFinalAmount.toFixed(2),

        final_amount:
          newFinalAmount.toFixed(2),

        paid_amount:
          paidAfter.toFixed(2),

        remaining_amount:
          remainingAfter.toFixed(2),

        payment_status:
          newPaymentStatus,
      });


    } catch(error) {

      await client.query("ROLLBACK");

      console.error(
        "Individual work payment failed",
        error,
      );

      return res.status(500).json({
        error:"individual_payment_failed",
      });


    } finally {

      client.release();

    }

  },
);


router.get(
  "/global-balances",
  requireAuth,
  async (_req, res) => {

    try {

      const result = await pool.query(`
        WITH settlement_totals AS (
          SELECT
            doctor_id,
            COALESCE(SUM(works_total), 0)
              AS settled_total

          FROM doctor_settlements

          GROUP BY doctor_id
        ),

        global_operations AS (
          SELECT
            doctor_id,

            COALESCE(
              SUM(
                amount + adjustment_amount
              ),
              0
            ) AS covered_total

          FROM payments

          WHERE payment_type = 'global'

          GROUP BY doctor_id
        )

        SELECT
          d.id AS doctor_id,
          d.name AS doctor_name,

          COALESCE(
            st.settled_total,
            0
          ) AS settled_total,

          COALESCE(
            go.covered_total,
            0
          ) AS covered_total,

          GREATEST(
            COALESCE(
              st.settled_total,
              0
            )
            -
            COALESCE(
              go.covered_total,
              0
            ),
            0
          ) AS global_balance

        FROM doctors d

        LEFT JOIN settlement_totals st
          ON st.doctor_id = d.id

        LEFT JOIN global_operations go
          ON go.doctor_id = d.id

        WHERE d.active = true
           OR COALESCE(
                st.settled_total,
                0
              ) > 0

        ORDER BY d.name
      `);


      return res.json(result.rows);


    } catch(error) {

      console.error(
        "Global balances load failed",
        error,
      );

      return res.status(500).json({
        error:"global_balances_load_failed",
      });

    }

  },
);


router.post(
  "/global-settlements",
  requireAuth,
  async (req, res) => {

    const doctorId =
      Number(req.body?.doctor_id);

    const workIds =
      Array.isArray(req.body?.work_ids)
        ? req.body.work_ids.map(Number)
        : [];

    const amount =
      Number(req.body?.amount);

    const requestedFinalAmount =
      Number(req.body?.final_amount);

    const note =
      String(req.body?.note ?? "")
        .trim();

    const paymentDate =
      req.body?.payment_date
        ? String(req.body.payment_date)
        : null;


    if(
      !Number.isInteger(doctorId) ||
      doctorId <= 0
    ) {

      return res.status(400).json({
        error:"invalid_doctor",
      });

    }


    if(
      workIds.length === 0 ||
      workIds.some(
        (workId:number)=>
          !Number.isInteger(workId) ||
          workId <= 0
      ) ||
      new Set(workIds).size !==
        workIds.length
    ) {

      return res.status(400).json({
        error:"invalid_works",
      });

    }


    if(
      !Number.isFinite(amount) ||
      amount < 0
    ) {

      return res.status(400).json({
        error:"invalid_amount",
      });

    }


    if(
      !Number.isFinite(requestedFinalAmount) ||
      requestedFinalAmount < 0
    ) {

      return res.status(400).json({
        error:"invalid_final_amount",
      });

    }


    if(amount <= 0) {

      return res.status(400).json({
        error:"invalid_amount",
      });

    }


    if(note.length > 500) {

      return res.status(400).json({
        error:"note_too_long",
      });

    }


    const client =
      await pool.connect();


    try {

      await client.query("BEGIN");


      const worksResult =
        await client.query(
          `
          WITH individual_payments AS (
            SELECT
              work_id,
              COALESCE(SUM(amount), 0)
                AS paid_amount

            FROM payments

            WHERE payment_type = 'individual'
              AND work_id = ANY($1::bigint[])

            GROUP BY work_id
          )

          SELECT
            w.id,
            w.doctor_id,
            w.total_amount,
            w.payment_status,

            GREATEST(
              w.total_amount
                - COALESCE(ip.paid_amount, 0),
              0
            ) AS amount_due

          FROM works w

          LEFT JOIN individual_payments ip
            ON ip.work_id = w.id

          WHERE w.id = ANY($1::bigint[])
            AND w.doctor_id = $2
            AND w.status = 'active'
            AND w.payment_status IN (
              'unpaid',
              'partial'
            )

          FOR UPDATE OF w
          `,
          [
            workIds,
            doctorId,
          ],
        );


      if(
        worksResult.rowCount !==
        workIds.length
      ) {

        await client.query("ROLLBACK");

        return res.status(409).json({
          error:"works_not_payable",
        });

      }


      const worksTotal =
        worksResult.rows.reduce(
          (sum,row)=>
            sum + Number(row.amount_due),
          0,
        );


      const previousBalanceResult =
        await client.query(
          `
          WITH settlement_total AS (
            SELECT
              COALESCE(
                SUM(works_total),
                0
              ) AS total

            FROM doctor_settlements

            WHERE doctor_id = $1
          ),

          covered_total AS (
            SELECT
              COALESCE(
                SUM(
                  amount + adjustment_amount
                ),
                0
              ) AS total

            FROM payments

            WHERE doctor_id = $1
              AND payment_type = 'global'
          )

          SELECT
            GREATEST(
              settlement_total.total
                - covered_total.total,
              0
            ) AS balance

          FROM settlement_total
          CROSS JOIN covered_total
          `,
          [doctorId],
        );


      const previousGlobalBalance =
        Number(
          previousBalanceResult
            .rows[0]
            .balance,
        );


      const totalGlobalDebt =
        previousGlobalBalance
          + worksTotal;


      if(worksTotal <= 0) {

        await client.query("ROLLBACK");

        return res.status(400).json({
          error:"empty_settlement",
        });

      }


      if(
        amount
          > requestedFinalAmount + 0.0001
      ) {

        await client.query("ROLLBACK");

        return res.status(400).json({
          error:"amount_exceeds_final_amount",

          final_amount:
            requestedFinalAmount.toFixed(2),
        });

      }


      const calculatedAdjustment =
        totalGlobalDebt
          - requestedFinalAmount;


      const settlementResult =
        await client.query(
          `
          INSERT INTO doctor_settlements(
            doctor_id,
            settlement_date,
            works_total,
            note
          )

          VALUES(
            $1,
            COALESCE($2::date, CURRENT_DATE),
            $3,
            $4
          )

          RETURNING *
          `,
          [
            doctorId,
            paymentDate,
            worksTotal,
            note || null,
          ],
        );


      const settlementId =
        settlementResult.rows[0].id;


      for(const work of worksResult.rows) {

        await client.query(
          `
          INSERT INTO doctor_settlement_works(
            settlement_id,
            work_id,
            amount_due
          )

          VALUES($1,$2,$3)
          `,
          [
            settlementId,
            work.id,
            work.amount_due,
          ],
        );

      }


      const paymentResult =
        await client.query(
          `
          INSERT INTO payments(
            doctor_id,
            settlement_id,
            amount,
            adjustment_amount,
            payment_type,
            payment_date,
            note
          )

          VALUES(
            $1,
            $2,
            $3,
            $4,
            'global',
            COALESCE($5::date, CURRENT_DATE),
            $6
          )

          RETURNING *
          `,
          [
            doctorId,
            settlementId,
            amount,
            calculatedAdjustment,
            paymentDate,
            note || null,
          ],
        );


      await client.query(
        `
        UPDATE works

        SET
          payment_status =
            'closed_global',
          updated_at = NOW()

        WHERE id = ANY($1::bigint[])
        `,
        [workIds],
      );


      await client.query("COMMIT");


      return res.status(201).json({
        settlement:
          settlementResult.rows[0],

        payment:
          paymentResult.rows[0],

        works_total:
          worksTotal.toFixed(2),

        previous_global_balance:
          previousGlobalBalance.toFixed(2),

        final_amount:
          requestedFinalAmount.toFixed(2),

        adjustment_amount:
          calculatedAdjustment.toFixed(2),

        remaining_global_balance:
          Math.max(
            requestedFinalAmount
              - amount,
            0,
          ).toFixed(2),
      });


    } catch(error) {

      await client.query("ROLLBACK");

      console.error(
        "Global settlement failed",
        error,
      );

      return res.status(500).json({
        error:"global_settlement_failed",
      });


    } finally {

      client.release();

    }

  },
);


router.post(
  "/global-payments",
  requireAuth,
  async (req, res) => {

    const doctorId =
      Number(req.body?.doctor_id);

    const amount =
      Number(req.body?.amount);

    const requestedFinalAmount =
      Number(req.body?.final_amount);

    const note =
      String(req.body?.note ?? "")
        .trim();

    const paymentDate =
      req.body?.payment_date
        ? String(req.body.payment_date)
        : null;


    if(
      !Number.isInteger(doctorId) ||
      doctorId <= 0
    ) {

      return res.status(400).json({
        error:"invalid_doctor",
      });

    }


    if(
      !Number.isFinite(amount) ||
      amount < 0
    ) {

      return res.status(400).json({
        error:"invalid_amount",
      });

    }


    if(
      !Number.isFinite(requestedFinalAmount) ||
      requestedFinalAmount < 0
    ) {

      return res.status(400).json({
        error:"invalid_final_amount",
      });

    }


    if(amount <= 0) {

      return res.status(400).json({
        error:"invalid_amount",
      });

    }


    if(note.length > 500) {

      return res.status(400).json({
        error:"note_too_long",
      });

    }


    try {

      const balanceResult =
        await pool.query(
          `
          WITH settlement_total AS (
            SELECT
              COALESCE(SUM(works_total), 0)
                AS total

            FROM doctor_settlements

            WHERE doctor_id = $1
          ),

          covered_total AS (
            SELECT
              COALESCE(
                SUM(
                  amount + adjustment_amount
                ),
                0
              ) AS total

            FROM payments

            WHERE doctor_id = $1
              AND payment_type = 'global'
          )

          SELECT
            GREATEST(
              st.total - ct.total,
              0
            ) AS balance

          FROM settlement_total st
          CROSS JOIN covered_total ct
          `,
          [doctorId],
        );


      const balance =
        Number(
          balanceResult.rows[0].balance,
        );


      if(balance <= 0) {

        return res.status(409).json({
          error:"no_global_balance",
        });

      }


      if(
        amount
          > requestedFinalAmount + 0.0001
      ) {

        return res.status(400).json({
          error:"amount_exceeds_final_amount",

          final_amount:
            requestedFinalAmount.toFixed(2),
        });

      }


      const calculatedAdjustment =
        balance
          - requestedFinalAmount;


      const result =
        await pool.query(
          `
          INSERT INTO payments(
            doctor_id,
            amount,
            adjustment_amount,
            payment_type,
            payment_date,
            note
          )

          VALUES(
            $1,
            $2,
            $3,
            'global',
            COALESCE($4::date, CURRENT_DATE),
            $5
          )

          RETURNING *
          `,
          [
            doctorId,
            amount,
            calculatedAdjustment,
            paymentDate,
            note || null,
          ],
        );


      return res.status(201).json({
        payment:result.rows[0],

        final_amount:
          requestedFinalAmount.toFixed(2),

        adjustment_amount:
          calculatedAdjustment.toFixed(2),

        remaining_global_balance:
          Math.max(
            requestedFinalAmount
              - amount,
            0,
          ).toFixed(2),
      });


    } catch(error) {

      console.error(
        "Global payment failed",
        error,
      );

      return res.status(500).json({
        error:"global_payment_failed",
      });

    }

  },
);


export { router as paymentsRouter };
