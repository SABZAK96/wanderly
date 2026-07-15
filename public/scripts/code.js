document.getElementById("addTrip").addEventListener("click", () => {
  document.getElementById("my_modal_trip").showModal();
});

document.getElementById("inviteTrip").addEventListener("click", () => {
  document.getElementById("inviteModal").showModal();
});

// get the data from submitted modal
document.getElementById("createTrip").addEventListener("click", async () => {
  // validating inputs to be non empty
  const destination = document.getElementById("dest-title").value;
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  // get todays date in yyyy-mm-dd format
  const todayDate = new Date().toISOString().slice(0, 10);

  const tripError = document.getElementById("tripError");
  tripError.classList.add("hidden");

  if (destination.trim() === "") {
    tripError.textContent = "Please Enter your destination.";
    tripError.classList.remove("hidden");
    return;
  } else if (!startDate || !endDate) {
    tripError.textContent = "Please select both a start and end date.";
    tripError.classList.remove("hidden");
    return;
  } else if (endDate <= startDate) {
    tripError.textContent = "End date must be after the start date.";
    tripError.classList.remove("hidden");
    return;
  } else if (startDate < todayDate) {
    tripError.textContent = "Start date can't be in the past.";
    tripError.classList.remove("hidden");
    return;
  }

  // sending the info to db
  const response = await fetch("/addTrip", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      destination: destination,
      startDate: startDate,
      endDate: endDate,
    }),
  });
  if (response.ok) {
    const data = await response.json();

    // clear the form so the next "+ New Trip" opens blank, not with this trip's info
    document.getElementById("dest-title").value = "";
    document.getElementById("startDate").value = "";
    document.getElementById("endDate").value = "";

    // close the previous modal
    document.getElementById("my_modal_trip").close();
    document.getElementById("inviteModal").showModal();
    document.getElementById("link").value =
      `${window.location.origin}/join.html?trip=${data}`;
    loadYourTrips();
  } else {
    tripError.textContent = "Could not add the trip, please try again.";
    tripError.classList.remove("hidden");
  }
});

// this function gets the start date and end date and provide formatted data that will be used to show dates of
// the trips in the side bar
function formatTripDates(startStr, endStr) {
  // for turning a plain string such as "2022-08-11" to a date we should append T00:00:00 to it
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");

  // arrow function to get only month and day
  // date.toLocaleDateString(locale, formatoptions)
  const monthDay = (date) =>
    date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  // arrow function to get month, day, and the year
  const fullDate = (date) =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  // showing the compact version of the date such as jul 17 - 20 or jul 17 - sep 20
  // getDate gives the day of the month (getDay would give the day of the week instead)
  // this info is used in "your trips section"
  const compact =
    start.getMonth() === end.getMonth()
      ? `${monthDay(start)} - ${end.getDate()}`
      : `${monthDay(start)} - ${monthDay(end)}`;

  // showing the full version of date such as jul 20 - jul 23 , 2025 for trip details
  const full = `${monthDay(start)} - ${fullDate(end)}`;

  //computing the nights for trip details
  // subtracting 2 date objects gives us the total value in milliseconds that we should divide by the
  // total number of milliseconds in a day (1000 ms/sec × 60 sec/min × 60 min/hr × 24 hr/day)
  const nights = Math.round((end - start) / (1000 * 60 * 60 * 24));

  return { compact, full, nights };
}

// loading "your trips" in the side bar
async function loadYourTrips() {
  const data = await (await fetch("/allTrips")).json();
  const container = document.getElementById("yourTrips");
  container.innerHTML = "";
  data.forEach((trip) => {
    const startDate = trip.startDate.slice(0, 10); // gives sth like 2017-08-19
    const endDate = trip.endDate.slice(0, 10);
    const dateRange = formatTripDates(startDate, endDate);
    let element = "";
    element += `<div id ="${trip._id}"
                class="trip flex flex-row items-center justify-between gap-2 text-sm font-medium text-white px-2.5 py-2 rounded-xl hover:cursor-pointer"
                style="background: rgba(255, 255, 255, 0.16)"
                onmouseover="this.style.background = 'rgba(255,255,255,0.08)'"
                onmouseout="this.style.background = 'transparent'"
              >
                <span>${trip.destination.charAt(0).toUpperCase() + trip.destination.slice(1)}</span
                ><span class="text-xs font-normal text-white/70"
                  >${dateRange.compact}</span
                >
              </div>`;
    container.insertAdjacentHTML("beforeend", element);
  });
}

loadYourTrips();
