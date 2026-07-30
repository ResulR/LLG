import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

import {
  useMonth,
} from "@/context/MonthContext";


function formatMonthLabel(
  month:string,
) {

  const [
    year,
    monthNumber,
  ] = month
    .split("-")
    .map(Number);


  const date =
    new Date(
      year,
      monthNumber - 1,
      1,
    );


  const formatted =
    new Intl.DateTimeFormat(
      "sq-AL",
      {
        month:"long",
        year:"numeric",
      },
    ).format(date);


  return (
    formatted.charAt(0).toUpperCase()
    + formatted.slice(1)
  );

}


export default function MonthNavigator() {

  const {
    selectedMonth,
    setSelectedMonth,
    previousMonth,
    nextMonth,
    currentMonth,
    isCurrentMonth,
  } = useMonth();


  return (
    <section
      className="global-month-navigator"
      aria-label="Zgjedhja e muajit"
    >

      <button
        type="button"
        className="global-month-arrow"
        onClick={previousMonth}
        aria-label="Muaji i mëparshëm"
        title="Muaji i mëparshëm"
      >
        <ChevronLeft size={17} />
      </button>


      <label className="global-month-picker">

        <span>
          {formatMonthLabel(
            selectedMonth,
          )}
        </span>

        <input
          type="month"
          value={selectedMonth}
          onChange={(event)=>
            setSelectedMonth(
              event.target.value,
            )
          }
          aria-label="Zgjidhni muajin"
        />

      </label>


      <button
        type="button"
        className="global-month-arrow"
        onClick={nextMonth}
        aria-label="Muaji i ardhshëm"
        title="Muaji i ardhshëm"
      >
        <ChevronRight size={17} />
      </button>


      {!isCurrentMonth && (
        <button
          type="button"
          className="global-month-current"
          onClick={currentMonth}
          title="Kthehu te muaji aktual"
        >
          <RotateCcw size={14} />
          <span>Ky muaj</span>
        </button>
      )}

    </section>
  );

}
