// invitation logic for the button that appears next to each single trip
document
  .getElementById("tripHeader")
  .addEventListener("click", async (event) => {
    const currentTrip = event.target.closest("#inviteTrip");
    if (!currentTrip) return;
    const currentTripId = currentTrip.closest("#tripHeader").dataset.tripId;
    document.getElementById("inviteModal").showModal();
    document.getElementById("link").value =
      `${window.location.origin}/join.html?trip=${currentTripId}&from=${await getMyId()}`;
  });

// add functionality to copy button in the modal
document
  .getElementById("inviteModal")
  .addEventListener("click", async (event) => {
    const copyBtn = event.target.closest("#joinBtn");
    const linkElement = document.getElementById("link");

    const errorMsg = document.getElementById("errorInvite");
    errorMsg.classList.add("hidden");

    const text = linkElement.value;

    try {
      // navigator.clipboard.writeText is the async Clipboard API
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
    } catch (error) {
      errorMsg.textContent = "Could not copy the link. try again.";
      errorMsg.classList.remove("hidden");
    }
  });

// fetches the selected trip's details and renders them into #tripHeader
async function getSingleTripDetails(tripId) {
  const trip = await (await fetch(`/singleTripDetails/${tripId}`)).json();
  const container = document.getElementById("tripHeader");
  container.dataset.tripId = tripId;

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

// sends the actual delete request for a trip id, called only after the user confirms
async function deleteTrip(id) {
  return fetch(`/deleteTrip/${id}`, { method: "DELETE" });
}

// clicking the trip header's delete icon opens the confirmation modal instead of
// deleting right away - #deleteTrip only exists once a trip is rendered into
// #tripHeader, so this listener has to live on the static #singleTripInfo container
document.getElementById("singleTripInfo").addEventListener("click", (event) => {
  if (!event.target.closest("#deleteTrip")) return;
  document.getElementById("deleteTripError").classList.add("hidden");
  document.getElementById("deleteTripConfirmModal").showModal();
});

// the modal's own delete button - this is what actually calls the delete route
document
  .getElementById("confirmDeleteTrip")
  .addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    if (btn.dataset.loading === "true") return; // guard against double-click

    // swap the button label for a spinner while the request is in flight
    const originalLabel = btn.innerHTML;
    btn.dataset.loading = "true";
    btn.innerHTML = `<span class="loading loading-dots loading-sm"></span>`;

    // the currently selected trip's id is stashed on #tripHeader when it's rendered
    const tripId = document.getElementById("tripHeader").dataset.tripId;
    const response = await deleteTrip(tripId);

    if (response.ok) {
      // close the modal and clear the now-deleted trip's header before
      // refreshing the sidebar so nothing stale is left on screen
      document.getElementById("deleteTripConfirmModal").close();
      document.getElementById("tripHeader").innerHTML = "";
      await loadYourTrips();
    } else {
      // leave the modal open on failure so the user can retry without re-confirming
      const deleteTripError = document.getElementById("deleteTripError");
      deleteTripError.textContent = "Failed to delete trip. Please try again.";
      deleteTripError.classList.remove("hidden");
    }

    btn.dataset.loading = "false";
    btn.innerHTML = originalLabel;
  });

async function editTripSetup(id) {
  const data = await (await fetch(`/singleTripDetails/${id}`)).json();

  // show the my_modal_trip with some modification
  document.getElementById("my_modal_trip").showModal();
  document.getElementById("my_modal_trip").dataset.editingTripId = id;
  document.getElementById("tripTitle").innerHTML = "Edit Trip";
  document.getElementById("createTrip").innerHTML = "Confirm";
  document.getElementById("dest-title").value = data.destination;
  document.getElementById("startDate").value = data.startDate.slice(0, 10);
  document.getElementById("endDate").value = data.endDate.slice(0, 10);
}

document
  .getElementById("tripHeader")
  .addEventListener("click", async (event) => {
    const createBtn = event.target.closest("#editTrip");
    if (!createBtn) return;
    const id = createBtn.closest("#tripHeader").dataset.tripId;
    await editTripSetup(id);
  });
