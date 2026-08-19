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
      return userTripsIds;
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

    // search places
    // returns { places: [ { id, displayName: { text }, formattedAddress, location: { latitude, longitude },
    //   priceLevel, priceRange: { startPrice, endPrice }, rating, userRatingCount, primaryType,
    //   editorialSummary: { text }, regularOpeningHours: { periods, weekdayDescriptions },
    //   photos: [ { name, widthPx, heightPx } ], websiteUri } ], nextPageToken }
    search_places: async (input, user) => {
      const locationBias = {
        circle: {
          center: { latitude: Number(input.lat), longitude: Number(input.lng) },
          radius: 50000, // 50000m (~50km) is the max radius the API allows for locationBias
        },
      };

      // for the first call when we dont have pageToken (nextToken) - also we can cache the results with claude
      if (!input.nextToken) {
        // build cacheKey
        const cacheKey =
          `${input.userQuery}|${Number(input.lat).toFixed(2)}|${Number(input.lng).toFixed(2)}`.toLowerCase();
        const cached = await placesCacheModel.findOne({ query: cacheKey });
        if (!cached) {
          const apiCall = await (
            await fetch("https://places.googleapis.com/v1/places:searchText", {
              method: "POST",
              body: JSON.stringify({
                textQuery: input.userQuery,
                pageSize: 20,
                pageToken: "",
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

          // skip caching google api errors
          if (!apiCall.error) {
            try {
              await placesCacheModel.create({
                query: cacheKey,
                results: apiCall,
              });
            } catch (cacheError) {
              // duplicate-key race: someone else cached this same query microseconds ago
            }
          }
          return apiCall;
        } else return cached.results;
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
