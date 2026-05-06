---
title: Imagine personal navigation service in the future
slug: imagine-personal-navigation-service-in-the-future
date: "2008-02-25T14:30:00.000Z"
tags:
  - GIS
  - 技术评论
source: cnblogs
sourceUrl: https://www.cnblogs.com/rib06/archive/2008/02/25/1080814.html
draft: false
---

What will the personal navigation service look like in 5 to 10 years? I mean the navigation for cars, pedestrians, bicyclers and the people who take public transportation.

At present the car navigation services are mainly provided by in-car PNDs. The portable navigation service for pedestrians, bicyclers and people take buses (or subways etc.) is almost just at the start step. The in-car navigation devices use CD or DVD as their local data source. But the PND can not be as  powerful as a PC. It has less memory, lower-frequency CPU, weaker display ability and smaller screen. Therefore to design the data structure of navigable database and route planning algorithms for such a PND must take the limited hardware resource into account. And that is a topic has been researched for years. Now, the car navigation device manufacturers can provide PND with high-quality navigable data and good path-finding performance.  However, what about the next step?

In the last several years, something that we should not ignore happened. One is the route planning service on Google Maps becoming better and better (see [The road to better path finding](http://googleblog.blogspot.com/2007/11/road-to-better-path-finding.html) from Google's official blog, btw, it may not be visited in China, you can visit it by some online RSS readers such as Google Reader). "*A small group of engineers (of which I was a part) created the Google Maps route-finding project in [Kirkland, WA](http://maps.google.com/maps?f=q&hl=en&geocode=&time=&date=&ttype=&q=kirkland,+WA&ie=UTF8&z=13&iwloc=addr&om=1) with the hope of building a world-class system for route-finding.*" In the blog, the author also mentioned that they have made thousands of MapReduce passes to complete the route planning job. It can be inferred that the job is also processed with the strong support of MapReduce framework just like many other data intensive and large scale computing job in Google. Although there is a new viewpoint from some database researchers that thinks [MapReduce as a major step backwards](http://www.databasecolumn.com/2008/01/mapreduce-a-major-step-back.html), MapReduce is still working as one component of the infrastructure in Google's big cluster to support the various high-quality services efficiently and effectively.

The second thing is the release of Android in 2007. That indicates the strategy of Google in the future. His next strategic emphasis must be mobile platform, or wireless Internet. With a mobile phone running Android as its OS, you could easily get the services provided by Google online. The Google Maps for mobile is surely one of them. So you can get the route planning service on Google Maps FREE because Google makes money by his advertisements.

I think from the two things above we could imagine the appearance of personal navigation service in 5 to 10 years. At that time, every user can have an access to Internet everywhere by a wired computer or a wireless smart phone. Personal navigation must adopt the wireless smart phone as its hardware platform. The smart phone is a general device with standard interfaces and could be very cheap. The navigable data and route planning algorithms are all in the service provider's servers. The network, computing and storage power will be the infrastructure of a country just like the electric power today. What the smart phone client should do is just to send its requests, receive and display the results. The communication between the smart phone and service providers will be based on the protocols like HTTP today, but it should be more efficient, more secure and more stable. Navigation just one of the massive functions. And you can hold it in your hand as a pedestrian navigator, plug it in a standard socket in your car as a car navigator and it could receive the data from Internet and display them on its own screen or transmit them to your car and then display them just on your windshield transparently. If you want to add high-resolution satellite imagery as background just press a button on the screen. If you want to add the 3D even 4D (with temporal dimension) scene to your view, also just press a button on the screen. The image data, 3D model data and navigable data may be come from multiple data sources, but the user doesn't need to care that at all.

At that time, which position will NAVTEQ and TeleAtlas be in the whole industrial chain? I think they will become data providers to the navigation service providers such as Google.

Please believe that I am not a mad fan of Google. The service provider could be any company. But so far, sadly I can only find Google as the game player. The more competitors the more fascinating will the navigation's future be, and the more comfortable will the customers be.

I hope that day will come soon.

*The end. Written by Windows Live Writer.*Lu LIU
