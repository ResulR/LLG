import {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";


type MonthContextValue = {
  selectedMonth:string;
  setSelectedMonth:(month:string)=>void;
  previousMonth:()=>void;
  nextMonth:()=>void;
  currentMonth:()=>void;
  isCurrentMonth:boolean;
};


const MonthContext =
  createContext<MonthContextValue|null>(
    null,
  );


function formatMonthValue(
  date:Date,
) {

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1,
    ).padStart(2,"0"),
  ].join("-");

}


function getCurrentMonth() {

  return formatMonthValue(
    new Date(),
  );

}


function moveMonth(
  current:string,
  offset:number,
) {

  const [
    yearValue,
    monthValue,
  ] = current
    .split("-")
    .map(Number);


  const date =
    new Date(
      yearValue,
      monthValue - 1 + offset,
      1,
    );


  return formatMonthValue(date);

}


export function MonthProvider({
  children,
}:{
  children:React.ReactNode;
}) {

  const [selectedMonth,setSelectedMonthState] =
    useState(
      ()=>{

        const stored =
          window.sessionStorage.getItem(
            "dentaltrack:selected-month",
          );


        if(
          stored &&
          /^\d{4}-\d{2}$/.test(stored)
        ) {
          return stored;
        }


        return getCurrentMonth();

      },
    );


  function setSelectedMonth(
    month:string,
  ) {

    if(!/^\d{4}-\d{2}$/.test(month)) {
      return;
    }


    setSelectedMonthState(month);

    window.sessionStorage.setItem(
      "dentaltrack:selected-month",
      month,
    );

  }


  const value =
    useMemo(
      ()=>({

        selectedMonth,

        setSelectedMonth,

        previousMonth:()=>{

          setSelectedMonth(
            moveMonth(
              selectedMonth,
              -1,
            ),
          );

        },

        nextMonth:()=>{

          setSelectedMonth(
            moveMonth(
              selectedMonth,
              1,
            ),
          );

        },

        currentMonth:()=>{

          setSelectedMonth(
            getCurrentMonth(),
          );

        },

        isCurrentMonth:
          selectedMonth ===
          getCurrentMonth(),

      }),
      [selectedMonth],
    );


  return (
    <MonthContext.Provider value={value}>
      {children}
    </MonthContext.Provider>
  );

}


export function useMonth() {

  const context =
    useContext(MonthContext);


  if(!context) {

    throw new Error(
      "useMonth must be used inside MonthProvider",
    );

  }


  return context;

}
