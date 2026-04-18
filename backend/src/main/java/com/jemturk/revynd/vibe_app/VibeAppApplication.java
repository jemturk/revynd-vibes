package com.jemturk.revynd.vibe_app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class VibeAppApplication {

	public static void main(String[] args) {
		SpringApplication.run(VibeAppApplication.class, args);
	}

}
