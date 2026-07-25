import {
  CalendarDays,
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

      <div className="global-month-copy">

        <span className="global-month-icon">
          <CalendarDays size={19} />
        </span>

        <div>
          <strong>Periudha e shfaqur</strong>

          <small>
            Ndryshoni muajin për të parë
            të dhënat përkatëse
          </small>
        </div>

      </div>


      <div className="global-month-controls">

        <button
          type="button"
          className="global-month-arrow"
          onClick={previousMonth}
          aria-label="Muaji i mëparshëm"
          title="Muaji i mëparshëm"
        >
          <ChevronLeft size={19} />
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
          <ChevronRight size={19} />
        </button>


        <button
          type="button"
          className="global-month-current"
          onClick={currentMonth}
          disabled={isCurrentMonth}
        >
          <RotateCcw size={15} />
          Ky muaj
        </button>

      </div>

    </section>
  );

}
