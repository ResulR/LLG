import {
  Router,
} from "express";

import {
  pool,
} from "../db/pool.js";

import {
  requireAuth,
} from "../middleware/auth.js";


const router =
  Router();


function cleanMaterialName(
  value:unknown,
) {

  return String(
    value ?? "",
  ).trim();

}


router.get(
  "/",
  requireAuth,
  async (_req,res) => {

    try {

      const result =
        await pool.query(
          `
            SELECT
              m.id,
              m.name,
              m.active,
              m.created_at,

              COUNT(w.id)::int
                AS usage_count

            FROM materials m

            LEFT JOIN works w
              ON w.material_id = m.id

            GROUP BY
              m.id,
              m.name,
              m.active,
              m.created_at

            ORDER BY
              m.active DESC,
              LOWER(m.name),
              m.id
          `,
        );


      return res.json(
        result.rows,
      );


    } catch(error) {

      console.error(
        "Materials load failed",
        error,
      );


      return res.status(500).json({
        error:"materials_load_failed",
      });

    }

  },
);


router.post(
  "/",
  requireAuth,
  async (req,res) => {

    const name =
      cleanMaterialName(
        req.body?.name,
      );


    if(!name) {

      return res.status(400).json({
        error:"missing_name",
      });

    }


    if(name.length > 120) {

      return res.status(400).json({
        error:"name_too_long",
      });

    }


    try {

      const result =
        await pool.query(
          `
            INSERT INTO materials(
              name
            )
            VALUES($1)

            RETURNING
              id,
              name,
              active,
              created_at,
              0::int AS usage_count
          `,
          [name],
        );


      return res
        .status(201)
        .json(
          result.rows[0],
        );


    } catch(error:any) {

      if(error?.code === "23505") {

        return res.status(409).json({
          error:"material_name_exists",
        });

      }


      console.error(
        "Material creation failed",
        error,
      );


      return res.status(500).json({
        error:"material_creation_failed",
      });

    }

  },
);


router.put(
  "/:id",
  requireAuth,
  async (req,res) => {

    const materialId =
      Number(
        req.params.id,
      );

    const name =
      cleanMaterialName(
        req.body?.name,
      );


    if(
      !Number.isInteger(materialId) ||
      materialId <= 0
    ) {

      return res.status(400).json({
        error:"invalid_material_id",
      });

    }


    if(!name) {

      return res.status(400).json({
        error:"missing_name",
      });

    }


    if(name.length > 120) {

      return res.status(400).json({
        error:"name_too_long",
      });

    }


    try {

      const result =
        await pool.query(
          `
            UPDATE materials
            SET name = $1
            WHERE id = $2

            RETURNING
              id,
              name,
              active,
              created_at,

              (
                SELECT COUNT(*)::int
                FROM works
                WHERE material_id = materials.id
              ) AS usage_count
          `,
          [
            name,
            materialId,
          ],
        );


      if(result.rowCount === 0) {

        return res.status(404).json({
          error:"material_not_found",
        });

      }


      return res.json(
        result.rows[0],
      );


    } catch(error:any) {

      if(error?.code === "23505") {

        return res.status(409).json({
          error:"material_name_exists",
        });

      }


      console.error(
        "Material update failed",
        error,
      );


      return res.status(500).json({
        error:"material_update_failed",
      });

    }

  },
);


router.patch(
  "/:id/status",
  requireAuth,
  async (req,res) => {

    const materialId =
      Number(
        req.params.id,
      );


    if(
      !Number.isInteger(materialId) ||
      materialId <= 0
    ) {

      return res.status(400).json({
        error:"invalid_material_id",
      });

    }


    if(
      typeof req.body?.active
      !== "boolean"
    ) {

      return res.status(400).json({
        error:"invalid_status",
      });

    }


    try {

      const result =
        await pool.query(
          `
            UPDATE materials
            SET active = $1
            WHERE id = $2

            RETURNING
              id,
              name,
              active,
              created_at,

              (
                SELECT COUNT(*)::int
                FROM works
                WHERE material_id = materials.id
              ) AS usage_count
          `,
          [
            req.body.active,
            materialId,
          ],
        );


      if(result.rowCount === 0) {

        return res.status(404).json({
          error:"material_not_found",
        });

      }


      return res.json(
        result.rows[0],
      );


    } catch(error) {

      console.error(
        "Material status update failed",
        error,
      );


      return res.status(500).json({
        error:"material_status_update_failed",
      });

    }

  },
);


router.delete(
  "/:id",
  requireAuth,
  async (req,res) => {

    const materialId =
      Number(
        req.params.id,
      );


    if(
      !Number.isInteger(materialId) ||
      materialId <= 0
    ) {

      return res.status(400).json({
        error:"invalid_material_id",
      });

    }


    try {

      const material =
        await pool.query(
          `
            SELECT
              id,

              (
                SELECT COUNT(*)::int
                FROM works
                WHERE material_id = materials.id
              ) AS usage_count

            FROM materials

            WHERE id = $1
          `,
          [materialId],
        );


      if(material.rowCount === 0) {

        return res.status(404).json({
          error:"material_not_found",
        });

      }


      if(
        Number(
          material.rows[0].usage_count,
        ) > 0
      ) {

        return res.status(409).json({
          error:"material_in_use",
        });

      }


      await pool.query(
        `
          DELETE FROM materials
          WHERE id = $1
        `,
        [materialId],
      );


      return res.json({
        status:"deleted",
      });


    } catch(error) {

      console.error(
        "Material deletion failed",
        error,
      );


      return res.status(500).json({
        error:"material_deletion_failed",
      });

    }

  },
);


export {
  router as materialsRouter,
};
