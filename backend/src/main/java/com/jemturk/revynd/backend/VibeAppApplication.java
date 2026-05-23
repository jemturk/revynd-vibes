package com.jemturk.revynd.backend;

import java.sql.Connection;

import javax.sql.DataSource;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class VibeAppApplication {

	public static void main(String[] args) {
		ConfigurableApplicationContext context = SpringApplication.run(VibeAppApplication.class, args);
		// This block will print the absolute truth to your Cloud Run Logs
		try {
			DataSource dataSource = context.getBean(DataSource.class);
			try (Connection connection = dataSource.getConnection()) {
				System.out.println("🌍 LIVE CONTAINER DATABASE URL: " + connection.getMetaData().getURL());
				System.out.println("📦 DATABASE PRODUCT NAME: " + connection.getMetaData().getDatabaseProductName());
			}
		} catch (Exception e) {
			System.err.println("❌ CRITICAL CONNECTION METADATA FAULT: " + e.getMessage());
		}
	}

}
