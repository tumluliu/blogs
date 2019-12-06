After large amount of data cleaning, preprocessing and integrating work on the datasets from OpenStreetMap, UnitedMaps and the Munich underground station platform data collected by myself, a multimodal graph dataset for Munich area is finally ready to use. The data processing scripts are in the mmgraphdb-builder project on github. 

With the testbed prepared, I improved the pymmrouting (python wrapper of multimodal shortest path algorithms library) with a lot of refactoring and rewriting, did some slight improvement w.r.t the stablity and error handling on the C library mmspa (multimodal shortest path algorithms) I implemented in TUM, and then implemented an JSON RPC style API service for multimodal path finding. The API service is hosted just here on my website, the URL is:

http://luliu.me/mmrp/api/v1

The related open source projects are:

- [mmspa](https://github.com/tumluliu/mmspa)
- [pymmrouting](https://github.com/tumluliu/pymmrouting)
- [mmgraphdb-builder](https://github.com/tumluliu/mmgraphdb-builder)
- [mmrp-jsonrpc](https://github.com/tumluliu/mmrp-jsonrpc) 

The usage of the API can be found in the README of mmrp-jsonrpc. Here I paste the usage section:

## Sample usage

The API service provides two methods accepting POST requests: 

- `mmrp.index`: return a welcome message
- `mmrp.findMultimodalPaths`: do the multimodal route planning with given routing options

### Sample request on `mmrp.index`

Send a request via curl:

```bash
curl -i -X POST  -H "Content-Type: application/json" -d '{"jsonrpc": "2.0", "method": "mmrp.index", "params": {}, "id": "1"}' http://luliu.me/mmrp/api/v1
```

Response:

```bash
HTTP/1.1 200 OK
Date: Sat, 13 Jun 2015 10:55:30 GMT
Server: Apache/2.4.7 (Ubuntu)
Content-Type: application/json
Content-Length: 111

{
  "id": "1", 
  "jsonrpc": "2.0", 
  "result": "Welcome using Multimodal Route Planner (mmrp) JSON-RPC API"
}
```

### Sample request on `mmrp.findMultimodalPaths`

Both the request and response are too long to write here. The request can be found in `sample_request.sh`. And the response containing the feasible multimodal paths as well as switch points is in the `sample_response.json`.

## *IMPORTANT NOTES*

1. The testbed at the backend is just for Munich, Germany. The concrete bounding box is 11.360796,48.061602,11.722875,48.248220. So please make sure the source and target in your request are both within the bbox.
2. I am sure that you will feel that "WTF, the service is damn slow!". Yes, your feeling is correct because NO optimization on data preparation for each multimodal path finding process is applied yet. On average, the multimodal network assembling will take 3~5 seconds for each path searching plan while the pure path calculation will take around 0.5 seconds. Usually, a request may result in executing multiple path searching plans infered by a rule engine, so it is normal to have the feeling of slowness. However, it won't take more than one minute to get the response in the worst case.
3. Traffic rules like turning restrictions are not included for the moment.
4. Bus lines are not included for the moment.
5. Time tables for public transits are not included for the moment.
6. Station platform data are only available in underground network. Those in the suburban and tram stations have not yet been collected.

The limitation list is, well, not short. Why do I develop and release it? The only reason is there is NO practical multimodal routing engine can be found across the whole Internet that can provide such routing results:

- Drive to a parking lot with available positions, park the car there and walk to the destination
- Drive a car which can only run 10 km due to gas limit to a park and ride lot, park there and take public transit to go to the destination, but keep in mind that there should be enough gas left for you to drive the car back at least to a nearby gas station 
- I am a passenger this time, my wife drives. She takes me to a kiss and ride lot, I get off the car and take the underground line (I like underground more than other sort of public transits) to go to my destination, while she drives away back home or for work

At present, I am doing some multimodal path analysis work, and need a practical system/library/service being able to give routing results like above. But unfortunately I cannot find one. So I have to reorganize my phd work and use my own library although it is a little bit slow. 

In next steps, I may do some improvement work aiming at the above limitation list. But there is no scheduled plan yet. Now I am implementing a simple web demo - mmrp-web. It will be online within one month hopefully. 

There is already a Chinese version of this post. 

这篇帖子我已经写了中文版，需要的话请移步[这里](http://luliu.me?p=91)。 