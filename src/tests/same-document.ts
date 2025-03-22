import {NavigateEvent, Navigation} from "../navigation";
import {ok} from "../is";

{
    const navigation = new Navigation();

    await navigation.navigate("/").finished

    const promise = new Promise<NavigateEvent>(
        resolve => navigation.addEventListener(
            "navigate",
            (event) => {
                event.intercept({
                    async handler() {
                        resolve(event);
                    }
                })
            },
            { once: true }
        )
    );

    const other = `https://${Math.random()}.com/example`;

    await navigation.navigate(other).finished;

    const event = await promise;

    console.log(event.destination);

    ok(event.destination.url === other);
    ok(event.destination.sameDocument === false);


}