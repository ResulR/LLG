import {
  useEffect,
} from "react";


type UnsavedChangesEventDetail = {
  key:string;
  dirty:boolean;
};


export function useUnsavedChanges(
  key:string,
  dirty:boolean,
) {

  useEffect(
    ()=>{

      window.dispatchEvent(
        new CustomEvent<UnsavedChangesEventDetail>(
          "dentaltrack:form-dirty",
          {
            detail:{
              key,
              dirty,
            },
          },
        ),
      );


      return ()=>{

        window.dispatchEvent(
          new CustomEvent<UnsavedChangesEventDetail>(
            "dentaltrack:form-dirty",
            {
              detail:{
                key,
                dirty:false,
              },
            },
          ),
        );

      };

    },
    [
      dirty,
      key,
    ],
  );

}
