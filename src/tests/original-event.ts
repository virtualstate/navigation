import {Navigation} from "../navigation";
import {defer} from "../defer";
import {NavigationOriginalEvent} from "../create-navigation-transition";

{

    const navigation = new Navigation();

    navigation.addEventListener(
        "navigate",
        ({ intercept }) => {
            intercept()
        }
    );

    const originalEventDeferred = defer()
    const originalEvent = {
        preventDefault: originalEventDeferred.resolve
    };

    await navigation.navigate("/1", {
        [NavigationOriginalEvent]: originalEvent
    }).finished;

    await originalEventDeferred.promise;

    console.log("Original event preventDefault called");

}

{

    const navigation = new Navigation();

    navigation.addEventListener(
        "navigate",
        ({ preventDefault }) => {
            preventDefault()
        }
    );

    const originalEventDeferred = defer()
    const originalEvent = {
        preventDefault: originalEventDeferred.resolve
    };

    // preventDefault will abort the navigation
    navigation.navigate("/1", {
        [NavigationOriginalEvent]: originalEvent
    });

    await originalEventDeferred.promise;

    console.log("Original event preventDefault called");

}