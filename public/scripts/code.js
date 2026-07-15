document.getElementById("addTrip").addEventListener("click", () => {
  document.getElementById("my_modal_trip").showModal();
});

document.getElementById("singleTripInfo").addEventListener("click", (event) => {
  if (!event.target.closest("#inviteTrip")) return;
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
                class="trip flex flex-row items-center justify-between gap-2 text-sm font-medium text-white px-2.5 py-2 rounded-xl hover:cursor-pointer hover:bg-[rgba(255,255,255,0.08)]"
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

async function yourTripsStyle(event) {
  const element = event.target.closest(".trip");
  if (!element) return;

  // clear the style of bg of other elements if they exist
  const otherElements = [
    ...element.closest("#yourTrips").querySelectorAll(".trip"),
  ];
  otherElements.map((element) => (element.style.background = "transparent"));
  // add a bg color to selected trip
  element.style.background = "rgba(255, 255, 255, 0.16)";

  return element;
}
document
  .getElementById("yourTrips")
  .addEventListener("click", async (event) => {
    const element = await yourTripsStyle(event);
    if (!element) return;
    await getSingleTripDetails(element);
  });

async function getSingleTripDetails(element) {
  const tripId = element.id;
  const trip = await (await fetch(`/singleTripDetails/${tripId}`)).json();
  const container = document.getElementById("tripHeader");

  const start = trip.startDate.slice(0, 10);
  const end = trip.endDate.slice(0, 10);
  const dateInfo = formatTripDates(start, end);
  
  container.innerHTML = "";
  let addedElement = `<h2
                class="flex flex-row items-baseline justify-between gap-2 text-base font-semibold text-white"
              >
                <span>${trip.destination}</span
                ><span class="text-sm font-normal text-white">${dateInfo.compact}</span>
              </h2>
              <!-- card containing the trip info -->
              <div class="card flex-1 bg-base-100 card-xs shadow-sm">
                <div class="card-body">
                  <div class="flex flex-row items-start justify-between gap-2">
                    <div>
                      <h2 id="destName" class="card-title">${trip.destination}</h2>
                      <p id="tripDate">${dateInfo.full}</p>
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                      <button
                        id="inviteTrip"
                        class="btn btn-ghost btn-xs btn-square"
                        aria-label="Invite people"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z"
                          />
                        </svg>
                      </button>
                      <button
                        id="editTrip"
                        class="btn btn-ghost btn-xs btn-square"
                        aria-label="Edit trip"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                          />
                        </svg>
                      </button>
                      <button
                        id="deleteTrip"
                        class="btn btn-ghost btn-xs btn-square text-error"
                        aria-label="Delete trip"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div class="flex flex-row gap-1">
                    <div
                      id="nights"
                      class="badge badge-secondary text-xs rounded-full p-2"
                    >
                      ${dateInfo.nights} nights
                    </div>
                    <div
                      id="people"
                      class="badge badge-success text-xs rounded-full p-2"
                    >
                      ${trip.people.length} person(s)
                    </div>
                  </div>
                </div>
              </div>`;
  container.insertAdjacentHTML("beforeend", addedElement);
}
