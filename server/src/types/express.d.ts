import type {
  SessionTokenPayload,
} from "../services/auth.js";

import type {
  SessionRecord,
} from "../services/session.js";


declare global {

  namespace Express {

    interface Request {

      user?:SessionTokenPayload;

      sessionInfo?:SessionRecord;

    }

  }

}


export {};
