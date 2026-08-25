// tools should mirror what the corresponding routes do
module.exports = function createToolHandlers({
  tripModel,
  userModel,
  packingModel,
  assignBadgeIfNeeded,
  activityModel,
  placesCacheModel,
}) {
  return {
    // create trip
    // returns trip._id (plain string, not wrapped in an object)
    create_trip: async (input, user) => {
      const trip = await tripModel.create({
        destination: input.destination,
        destinationName: input.destinationName,
        startDate: input.startDate,
        endDate: input.endDate,
        lat: input.lat,
        lng: input.lng,
        people: [{ person: user.userId, badgeInfo: {} }],
        expenses: [],
        payments: [],
      });
      await userModel.findByIdAndUpdate(user.userId, {
        $push: { trips: trip._id },
      });
      const newPackingDoc = await packingModel.create({
        person: user.userId,
        tripId: trip._id,
      });
      newPackingDoc.packingList.push(
        { category: "Documents & Essentials" },
        { category: "Weather Essentials" },
        { category: "Planned Activities" },
        { category: "Toiletries & Health" },
      );
      await newPackingDoc.save();
      await assignBadgeIfNeeded(user.userId, trip._id);

      return trip._id;
    },

    // get weather forecast
    // returns { forecastDays: [ { maxTemperature: { degrees }, minTemperature: { degrees },
    //   daytimeForecast: { weatherCondition: { description: { text } }, precipitation: { probability: { percent } },
    //     wind: { speed: { value }, direction: { cardinal } } },
    //   nighttimeForecast: {...same shape as daytimeForecast...} } ] }
    get_weather_forecast: async (input) => {
      const apiCall = await (
        await fetch(
          `https://weather.googleapis.com/v1/forecast/days:lookup?key=${process.env.GOOGLE_PLACES_API}&location.latitude=${input.lat}&location.longitude=${input.lng}&days=10&pageSize=10`,
        )
      ).json();

      return apiCall;
    },

    // get current weather
    // returns { weatherCondition: { description: { text } }, temperature: { degrees },
    //   feelsLikeTemperature: { degrees }, relativeHumidity, uvIndex,
    //   precipitation: { probability: { percent } }, wind: { speed: { value }, direction: { cardinal } } }
    get_current_weather: async (input) => {
      const apiCall = await (
        await fetch(
          `https://weather.googleapis.com/v1/currentConditions:lookup?key=${process.env.GOOGLE_PLACES_API}&location.latitude=${input.lat}&location.longitude=${input.lng}`,
        )
      ).json();

      return apiCall;
    },

    //add group activity - user carries {userId: ... , tripId: ...}
    // returns { _id, tripId, participants, activityName, date, startTime, endTime, address, placeId, location } or { error }
    add_activity_group: async (input, user) => {
      // do the activity date validation first - retrieve the trip start and end date
      const trip = await tripModel.findById(user.tripId);
      const validation = invalidDateReason(input.date, trip);

      // date is a require field in our schema so we wont check the presence of it, as we do in validateActivityDate
      if (validation === null) {
        if (input.startTime < input.endTime) {
          const peopleId = trip.people.map((element) => element.person);
          const grpActivity = await activityModel.create({
            tripId: user.tripId,
            participants: peopleId,
            addedBy: "claude",
            activityName: input.activityName,
            date: input.date,
            startTime: input.startTime,
            endTime: input.endTime,
            address: input.address,
            placeId: input.placeId,
            location: input.location,
          });
          return grpActivity;
        } else {
          return { error: "activity time is invalid." };
        }
      } else return { error: validation };
    },

    // add activity solo
    // returns { _id, tripId, participants, activityName, date, startTime, endTime, address, placeId, location } or { error }
    add_activity_solo: async (input, user) => {
      const trip = await tripModel.findById(user.tripId);
      const validation = invalidDateReason(input.date, trip);

      // date is a require field in our schema so we wont check the presence of it, as we do in validateActivityDate
      if (validation === null) {
        if (input.startTime < input.endTime) {
          const soloActivity = await activityModel.create({
            tripId: user.tripId,
            participants: user.userId,
            addedBy: "claude",
            activityName: input.activityName,
            date: input.date,
            startTime: input.startTime,
            endTime: input.endTime,
            address: input.address,
            placeId: input.placeId,
            location: input.location,
          });
          return soloActivity;
        } else {
          return { error: "activity time is invalid." };
        }
      } else {
        return { error: validation };
      }
    },

    // edit activity
    // returns { _id, tripId, participants, activityName, date, startTime, endTime, address, placeId, location } or { error }
    edit_activity: async (input, user) => {
      // check activity membership
      const membership = await activityMembership(
        activityModel,
        tripModel,
        input.activityId,
        user.userId,
      );
      if (membership.error) return { error: membership.error };
      else {
        const { trip } = membership;
        // time validation - considering date is optional
        const date = input?.date ?? undefined;
        if (date) {
          const validation = invalidDateReason(date, trip);
          if (validation !== null) return { error: validation };
        }
        if (input.startTime < input.endTime) {
          const updatedActivity = await activityModel.findByIdAndUpdate(
            input.activityId,
            {
              $set: {
                date: input.date,
                startTime: input.startTime,
                endTime: input.endTime,
              },
            },
            { new: true },
          );

          return updatedActivity;
        } else {
          return { error: "activity time is invalid." };
        }
      }
    },

    // list trips
    list_trips: async (input, user) => {
      const userDoc = await userModel.findById(user.userId, { trips: 1 });
      const userTripsIds = await Promise.all(
        userDoc.trips.map((id) => tripModel.findById(id)),
      );
      // the conversation is already scoped to user.tripId (from the /askAI/:tripId
      // URL) - flag it here so the model can resolve "this trip" itself instead
      // of asking the user to disambiguate
      return userTripsIds.map((trip) => ({
        ...trip.toObject(), // convert mongoose document to a js object and add a new field to each document
        isCurrentTrip: String(trip._id) === String(user.tripId),
      }));
    },

    // delete activity solo
    // returns { _id, tripId, participants, activityName, date, startTime, endTime, address, placeId, location } (participants minus the user) or { error }
    delete_activity_solo: async (input, user) => {
      const membership = await activityMembership(
        activityModel,
        tripModel,
        input.activityId,
        user.userId,
      );
      if (membership.error) return { error: membership.error };
      const { activity } = membership;
      const newParticipants = activity.participants.filter(
        (element) => element !== user.userId,
      );
      activity.participants = newParticipants;
      await activity.save();
      if (newParticipants.length === 0) {
        await activityModel.findByIdAndDelete(activity._id);
      }
      return activity;
    },

    // delete activity grp
    // returns { _id, tripId, participants, activityName, date, startTime, endTime, address, placeId, location } (the now-deleted doc) or { error }
    delete_activity_group: async (input, user) => {
      const membership = await activityMembership(
        activityModel,
        tripModel,
        input.activityId,
        user.userId,
      );
      if (membership.error) return { error: membership.error };
      const { activity } = membership;
      await activityModel.findByIdAndDelete(activity._id);
      return activity; // give claude something to reference when telling user what got deleted
    },

    // list activities
    // returns [ { _id, activityName, date, startTime, endTime, address, placeId, location } ]
    list_activities: async (input, user) => {
      const activities = await activityModel.find({ tripId: user.tripId });
      const userActivities = activities.filter((activity) =>
        activity.participants.includes(user.userId),
      );
      return userActivities;
    },

    // add packing items
    // returns { packingList: [ { category, items: [ { title } ] } ] } — full list, all categories
    add_packing_items: async (input, user) => {
      const userPackingList = await packingModel.findOneAndUpdate(
        { person: user.userId, tripId: user.tripId },
        { $push: { "packingList.$[elem].items": { $each: input.items } } }, // bulk inserting with $each
        { arrayFilters: [{ "elem.category": input.category }], new: true },
      );
      return userPackingList;
    },

    attach_place_details: async (input, user) => {
      return input;
    },

    // activities_preview
    // self-contained: searches Places per interest (+ restaurants, if wanted),
    // merges/dedupes, ranks by popularity, and trims to a shortlist sized for
    // the trip's actual duration/pace.
    // returns { places: [ ...same shape as search_places' places... ] }
    activities_preview: async (input, user) => {
      const trip = await tripModel.findById(user.tripId);

      // subtracting Date objects, gives  the difference in milliseconds.
      const tripDays =
        Math.round(
          (new Date(trip.endDate) - new Date(trip.startDate)) /
            (1000 * 60 * 60 * 24),
        ) + 1;

      let perDay = 4;
      if (input.pace.toLowerCase() === "relaxed") perDay = 3;
      else if (input.pace.toLowerCase() === "packed") perDay = 6;
      // cap the results tp 30
      const desiredCount = Math.min(30, Math.max(4, perDay * tripDays));

      const radius = modeRadius(input.transportationMode);

      const queries = [...input.interests];
      if (input.restaurantInterest) queries.push("restaurants");

      const results = await Promise.all(
        queries.map((query) =>
          searchPlacesText(
            query,
            input.lat,
            input.lng,
            radius,
            placesCacheModel,
          ),
        ),
      );

      const foundPlaces = results.flatMap((apiCall) => apiCall.places || []);

      const allPlaces = [];

      // we might get same place when calling google api, we dont wanna duplicate results
      foundPlaces.forEach((place) => {
        if (!allPlaces.some((p) => p.id === place.id)) {
          allPlaces.push(place);
        }
      });
      const scored = allPlaces
        .map((place) => ({
          place,
          score: weightedRating(place, allPlaces, 30),
        }))
        .sort((a, b) => b.score - a.score);

      return {
        places: scored.slice(0, desiredCount).map((entry) => entry.place),
      };
    },
    // search places
    // returns { places: [ { id, displayName: { text }, formattedAddress, location: { latitude, longitude },
    //   priceLevel, priceRange: { startPrice, endPrice }, rating, userRatingCount, primaryType,
    //   editorialSummary: { text }, regularOpeningHours: { periods, weekdayDescriptions },
    //   photos: [ { name, widthPx, heightPx } ], websiteUri } ], nextPageToken }
    search_places: async (input, user) => {
      const locationBias = {
        circle: {
          center: { latitude: Number(input.lat), longitude: Number(input.lng) },
          radius: 50000,
        },
      };

      // for the first call when we dont have pageToken (nextToken) - also we can cache the results with claude
      if (!input.nextToken) {
        return await searchPlacesText(
          input.userQuery,
          input.lat,
          input.lng,
          50000, // 50000m (~50km) is the max radius the API allows for locationBias
          placesCacheModel,
        );
      } else {
        const apiCall = await (
          await fetch("https://places.googleapis.com/v1/places:searchText", {
            method: "POST",
            body: JSON.stringify({
              textQuery: input.userQuery,
              pageSize: 20,
              pageToken: input.nextToken,
              locationBias,
            }),
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API,
              "X-Goog-FieldMask":
                "places.id,places.displayName,places.formattedAddress,places.priceLevel,places.photos,places.regularOpeningHours,places.priceRange,places.rating,places.userRatingCount,places.editorialSummary,places.primaryType,places.location,places.websiteUri,nextPageToken",
            },
          })
        ).json();
        return apiCall;
      }
    },
  };
};

// same IMDB weighted-rating formula as public/scripts/code.js
function weightedRating(item, allItems, m) {
  // API might not return some data - we filter them out
  const reviewedItems = allItems.filter(
    (candidate) => candidate.rating != null,
  );

  // formula = (v / (v + m)) * R + (m / (v + m)) * C

  // calculate c - average rating across the current result set
  const setSumRating = reviewedItems.reduce(
    (sum, element) => sum + element.rating,
    0,
  );

  const c =
    reviewedItems.length !== 0 ? setSumRating / reviewedItems.length : 0;

  // calculating v - the place's own review count
  const v = item.userRatingCount ?? 0;

  // calculating r - the place's own average rating
  const r = item.rating ?? c; // no rating at all -> fall back to the set average

  const score = (v / (v + m)) * r + (m / (v + m)) * c;
  return score;
}

// picks a search radius from how they're getting around - car/transit can
// reasonably cover more ground than walking. defaults to the max (50km)
function modeRadius(transportationMode) {
  const modes = transportationMode.map((mode) => mode.toLowerCase());

  if (modes.includes("car")) {
    return 50000;
  }

  if (modes.includes("transit")) {
    return 20000;
  }

  if (modes.includes("walking")) {
    return 3000;
  }

  return 50000;
}

// single-page Places Text Search, cached the same way search_places caches its
// first page - used by activities_preview to pull one pool of candidates per interest
async function searchPlacesText(query, lat, lng, radius, placesCacheModel) {
  const cacheKey =
    `${query}|${Number(lat).toFixed(2)}|${Number(lng).toFixed(2)}|${radius}`.toLowerCase();
  const cached = await placesCacheModel.findOne({ query: cacheKey });
  if (cached) return cached.results;

  const apiCall = await (
    await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      body: JSON.stringify({
        textQuery: query,
        pageSize: 20,
        pageToken: "",
        locationBias: {
          circle: {
            center: { latitude: Number(lat), longitude: Number(lng) },
            radius,
          },
        },
      }),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.priceLevel,places.photos,places.regularOpeningHours,places.priceRange,places.rating,places.userRatingCount,places.editorialSummary,places.primaryType,places.location,places.websiteUri,nextPageToken",
      },
    })
  ).json();

  if (!apiCall.error) {
    try {
      await placesCacheModel.create({ query: cacheKey, results: apiCall });
    } catch (cacheError) {
      // duplicate-key race: someone else cached this same query microseconds ago
    }
  }
  return apiCall;
}

// returns an error string if date falls outside the trip's range, else null
function invalidDateReason(date, trip) {
  const startDate = new Date(trip.startDate).toISOString().slice(0, 10);
  const endDate = new Date(trip.endDate).toISOString().slice(0, 10);
  if (date > endDate || date < startDate) return "activity date is invalid.";
  return null;
}

// returns { activity, trip } if the activity exists and userId is a member of its trip, else { error }
async function activityMembership(
  activityModel,
  tripModel,
  activityId,
  userId,
) {
  const activity = await activityModel.findById(activityId);

  if (!activity) {
    return { error: "activity does not exist." };
  }
  const trip = await tripModel.findById(activity.tripId);
  if (!trip || !trip.people.some((p) => p.person === userId)) {
    return { error: "Not a member of this trip." };
  }
  return { activity, trip };
}
