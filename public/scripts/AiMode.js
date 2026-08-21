let tripId = localStorage.getItem("selectedTripId");
const pickTripBtn = document.getElementById("pickTripComposerBtn");
const composerInput = document.getElementById("composerInput");
const threadContainer = document.getElementById("convoThread");

// caches the Places API key across calls (and across code.js reusing this
// same function) instead of re-fetching
// it from our own server on every turn/search
let placesApiKey;
async function getPlacesKey() {
  if (!placesApiKey) {
    const { key } = await (await fetch("/config/places-key")).json();
    placesApiKey = key;
  }
  return placesApiKey;
}

document.addEventListener("changeTrip", (e) => {
  tripId = e.detail.tripId;
  checkToggle();
});
document.addEventListener("tripDeleted", () => {
  tripId = "";
  checkToggle();
});
document.addEventListener("tripAdded", (e) => {
  tripId = e.detail.tripId;
  checkToggle();
});

// shows the trip-picker button or the real composer input, based on whether a trip is selected
function checkToggle() {
  if (tripId) {
    pickTripBtn.classList.add("hidden");
    composerInput.classList.remove("hidden");
  } else {
    pickTripBtn.classList.remove("hidden");
    composerInput.classList.add("hidden");
  }
}
checkToggle();

pickTripBtn.addEventListener("click", () => {
  loadTrips().then(() => suggestModal.showModal());
});

// wire up everything
const inputField = composerInput.querySelector("input");
inputField.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    aiChat(inputField.value);
    inputField.value = "";
    inputField.focus();
  }
});

let messages = [];

// sends the user's message to Claude and renders whatever comes back
async function aiChat(query) {
  messages = [...messages, { role: "user", content: query }];
  renderChat({ query: query });
  try {
    const response = await fetch(`/askAI/${tripId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    });
    if (response.ok) {
      const data = await response.json();
      let toolResult;
      messages = data.messages;
      // filter assistant messages
      const textResponses = messages
        .filter((element) => element.role === "assistant")
        .flatMap((element) => element.content)
        .filter((element) => element && element.type === "text");

      const lastResponse = textResponses.findLast(
        (element) => element.type === "text",
      );
      const allToolUsedBlocks = messages
        .filter((item) => item.role === "assistant")
        .flatMap((item) =>
          item.content.filter((block) => block.type === "tool_use"),
        );

      const allToolResultBlocks = messages
        .filter((item) => item.role === "user")
        .flatMap((element) => element.content)
        .filter((block) => block && block.type === "tool_result");

      const searchPlacesToolUsed = allToolUsedBlocks.findLast((block) =>
        ["search_places"].includes(block.name),
      );

      const activityToolUsed = allToolUsedBlocks.findLast((block) =>
        ["add_activity_group", "add_activity_solo"].includes(block.name),
      );

      const createTripToolUsed = allToolUsedBlocks.findLast(
        (block) => block.name === "create_trip",
      );
      if (createTripToolUsed) {
        const createResult = allToolResultBlocks.find(
          (block) => block.tool_use_id === createTripToolUsed.id,
        );
        if (createResult) {
          const parsedCreateResult = JSON.parse(createResult.content);
          if (!parsedCreateResult.error) {
            const newTripId = parsedCreateResult;
            // select the newly created trip, same as picking it from the sidebar
            localStorage.setItem("selectedTripId", newTripId);
            document.dispatchEvent(
              new CustomEvent("tripAdded", { detail: { tripId: newTripId } }),
            );
            getSingleTripDetails(newTripId).then(() =>
              getRecentActivities(newTripId),
            );
          } else {
            // don't rely only on Claude mentioning the rejection in its own reply
            renderChat({ error: parsedCreateResult.error });
          }
        }
      }
      if (activityToolUsed) {
        const activityResult = allToolResultBlocks.find(
          (block) => block.tool_use_id === activityToolUsed.id,
        );
        if (activityResult) {
          const parsedActivityResult = JSON.parse(activityResult.content);
          // only refresh the sidebar when there is no error
          if (!parsedActivityResult.error) {
            getRecentActivities(tripId);
          } else {
            renderChat({ error: parsedActivityResult.error });
          }
        }
      }

      if (searchPlacesToolUsed) {
        toolResult = allToolResultBlocks.find(
          (block) => block.tool_use_id === searchPlacesToolUsed.id,
        );

        const allDetailBlocks = messages
          .filter((m) => m.role === "assistant")
          .flatMap((m) =>
            m.content.filter(
              (b) => b.type === "tool_use" && b.name === "attach_place_details",
            ),
          );

        // merge results
        const places = JSON.parse(toolResult.content).places;
        // photos come back as a resource name, not a URL - need our own
        // key (same one used for the Autocomplete widget/Suggestions
        // cards, see code.js) to build the actual Photo media URL
        const key = await getPlacesKey();
        const enrichedPlaces = places.map((place) => {
          const details = allDetailBlocks.find(
            (block) => block.input.placeId === place.id,
          )?.input;
          const photoUrl =
            place.photos && place.photos[0]
              ? `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxHeightPx=400&key=${key}`
              : null;
          return { ...place, details: details ?? "unconfirmed", photoUrl };
        });
      }

      renderChat({ response: [lastResponse, enrichedPlaces] });
    } else {
      const text = await response.text();
      renderChat({ error: text });
    }
  } catch (error) {
    renderChat({ error: "Something went wrong. Please try again." });
  }
}

// appends a user bubble, Claude's reply, and/or search_places result cards to the thread
function renderChat(block) {
  if (block.query) {
    let userQuery = `<div class="chat chat-end">
              <div class="chat-bubble bg-base-100 text-base-content/80 md:text-md text-sm">
                ${block.query}
              </div>
            </div>`;
    threadContainer.insertAdjacentHTML("beforeend", userQuery);
  }
  if (block.error) {
    let errorBubble = `<div class="chat chat-start">
              <div class="chat-bubble chat-bubble-error md:text-md text-sm">
                ${block.error}
              </div>
            </div>`;
    threadContainer.insertAdjacentHTML("beforeend", errorBubble);
  }
  if (block.response) {
    block.response[0].forEach((item) => {
      let aiResponse = `  <div class="chat chat-start">
              <div class="chat-image avatar">
                <div
                  class="w-8 rounded-full flex items-center justify-center"
                  style="background: #3c3489"
                >
                  <span class="text-white text-base font-bold leading-none"
                    >W</span
                  >
                </div>
              </div>
              <div class="chat-header text-xs opacity-60">Claude</div>
              <div
                class="chat-bubble md:text-md text-sm"
                style="background: #534ab7; color: white"
              >
                ${item.text}
              </div>
            </div>`;
      threadContainer.insertAdjacentHTML("beforeend", aiResponse);
    });
    if (block.response[1] && block.response[1].length != 0) {
      const places = block.response[1];
      places.forEach((place) => {
        let suggestions = `<!-- container of the suggestions -->
            <section
              class="grid grid-cols-1 md:px-0 px-10 md:grid-cols-2 xl:grid-cols-3 content-start items-start gap-5 py-1 w-full"
            >
              <div data-id="${place.id}" class="card bg-base-100 shadow-sm border border-base-200">
                <figure class="relative">
                  <img
                    src="${place.photoUrl || "https://img.daisyui.com/images/stock/photo-1606107557195-0e29a4b5b4aa.webp"}"
                    alt="${place.displayName.text}"
                    class="w-full h-44 object-cover"
                  />
                  <div class="absolute top-2 right-2">
                    <span
                      class="badge text-xs font-medium px-2 py-1"
                      style="background: #eeedfe; color: #534ab7; border: none"
                      >ticket: ${place?.details?.ticketRequired === true ? "required" : "not Required"}</span
                    >
                  </div>
                </figure>
                <div class="card-body p-4 gap-2">
                  <div class="flex items-start justify-between gap-2">
                    <h2
                      class="card-title text-sm font-medium leading-tight"
                      style="color: #3c3489"
                    >
                      ${place.displayName.text}
                    </h2>
                    <div class="flex items-center gap-0.5 shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="#854F0B"
                        class="size-3.5"
                      >
                        <path
                          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                        />
                      </svg>
                      <span class="text-xs" style="color: #854f0b">4.8</span>
                    </div>
                  </div>
                  <p
                    class="text-xs text-base-content/60 leading-relaxed line-clamp-2"
                  >
                    ${place.editorialSummary?.text ?? ""}
                  </p>
                  <div class="flex flex-col gap-1.5 mt-1">
                    <div class="flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="#534AB7"
                        class="size-4 shrink-0"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z"
                        />
                      </svg>
                      <span class="text-xs text-base-content/70"
                        >Ticket price : ${place?.details?.priceInfo}</span
                      >
                    </div>
                    <div class="flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="#534AB7"
                        class="size-4 shrink-0"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                        />
                      </svg>
                      <span class="text-xs text-base-content/70"
                        >Duration: ${place?.details?.duration}</span
                      >
                    </div>
                    <div class="flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="#534AB7"
                        class="size-4 shrink-0"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                        />
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                        />
                      </svg>
                      <span class="text-xs text-base-content/70"
                        >${place.formattedAddress}</span
                      >
                    </div>
                    ${
                      place.primaryType
                        ? `<div class="flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="#534AB7"
                        class="size-4 shrink-0"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
                        />
                      </svg>
                      <span data-type="${place.primaryType}" class="text-xs text-base-content/70"
                        >${place.primaryType.replaceAll("_", " ")}</span
                      >
                    </div>`
                        : ""
                    }
                    ${
                      place?.details?.ticketLink
                        ? `<div class="flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="#534AB7"
                        class="size-4 shrink-0"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
                        />
                      </svg>
                      <a
                        href="${place?.details?.ticketLink}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-xs"
                        style="color: #534ab7; text-decoration: underline"
                        >Buy tickets</a
                      >
                    </div>`
                        : ""
                    }
                  </div>
                  <div class="card-actions justify-end mt-1">
                    <button
                      class="btn btn-sm text-white text-xs font-medium gap-1.5"
                      style="background: #534ab7; border: none"
                      onmouseover="this.style.background = '#3C3489'"
                      onmouseout="this.style.background = '#534AB7'"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="size-4"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"
                        />
                      </svg>
                      Add to calendar
                    </button>
                  </div>
                </div>
              </div>

              <!-- sample cards -->
              <!-- sample cards end -->
            </section>`;
        threadContainer.insertAdjacentHTML("beforeend", suggestions);
      });
    }
  }
}

